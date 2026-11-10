/**
 * A job queue shared by all events that takes turns between them: when a slot frees up, the next event in line
 * gets it, not the event with the most jobs waiting. With ten events on the same night, a busy hall cannot make
 * the guests at a quiet one wait behind its whole queue. Within one event, jobs run in the order they came.
 */
export class FairQueue {
  private lanes = new Map<string, string[]>();
  /** Jobs started per waiting event, to pick the one that has had the fewest turns. */
  private served = new Map<string, number>();
  /** Arrival order of the waiting events, to break ties. */
  private arrival = new Map<string, number>();
  private arrivals = 0;
  private running = new Set<string>();

  constructor(
    private readonly concurrency: number,
    private readonly work: (lane: string, id: string) => Promise<void>,
    private readonly onError: (lane: string, id: string, err: unknown) => void = () => undefined,
  ) {}

  private static key(lane: string, id: string) {
    return `${lane}\u0000${id}`;
  }

  /** Queues a job; false when the same job is already waiting or running. */
  add(lane: string, id: string): boolean {
    if (this.has(lane, id)) return false;
    const q = this.lanes.get(lane);
    if (q) q.push(id);
    else {
      // An event that was idle goes just ahead of the others once, then takes turns with them. Starting it at
      // zero instead would let it run alone until it caught up with an event that has been busy all night.
      if (!this.served.has(lane)) {
        const waiting = [...this.lanes.keys()].map((l) => this.served.get(l)!);
        this.served.set(lane, waiting.length ? Math.max(0, Math.min(...waiting) - 1) : 0);
      }
      this.arrival.set(lane, this.arrivals++);
      this.lanes.set(lane, [id]);
    }
    this.pump();
    return true;
  }

  has(lane: string, id: string): boolean {
    return this.running.has(FairQueue.key(lane, id)) || Boolean(this.lanes.get(lane)?.includes(id));
  }

  /** How many jobs, from all events, will start before this one. Null when it is not waiting. */
  ahead(lane: string, id: string): number | null {
    if (!this.lanes.get(lane)?.includes(id)) return null;
    // Replays the picking order on a copy; queues are short (hundreds at most), so this is cheap.
    const lanes = new Map([...this.lanes].map(([k, v]) => [k, [...v]]));
    const served = new Map(this.served);
    for (let n = 0; ; n++) {
      const pick = FairQueue.pick(lanes, served, this.arrival)!;
      const next = lanes.get(pick)!.shift()!;
      if (pick === lane && next === id) return n;
      served.set(pick, served.get(pick)! + 1);
      if (!lanes.get(pick)!.length) lanes.delete(pick);
    }
  }

  stats(lane?: string) {
    if (lane) {
      let running = 0;
      for (const key of this.running) if (key.startsWith(`${lane}\u0000`)) running++;
      return { waiting: this.lanes.get(lane)?.length ?? 0, running };
    }
    let waiting = 0;
    for (const q of this.lanes.values()) waiting += q.length;
    return { waiting, running: this.running.size };
  }

  private static pick(lanes: Map<string, string[]>, served: Map<string, number>, arrival: Map<string, number>): string | undefined {
    let best: string | undefined;
    for (const lane of lanes.keys()) {
      if (
        best === undefined ||
        served.get(lane)! < served.get(best)! ||
        (served.get(lane) === served.get(best) && arrival.get(lane)! < arrival.get(best)!)
      ) {
        best = lane;
      }
    }
    return best;
  }

  private next(): [string, string] | undefined {
    const lane = FairQueue.pick(this.lanes, this.served, this.arrival);
    if (!lane) return undefined;
    const q = this.lanes.get(lane)!;
    const id = q.shift()!;
    this.served.set(lane, this.served.get(lane)! + 1);
    if (!q.length) {
      this.lanes.delete(lane);
      this.arrival.delete(lane);
    }
    return [lane, id];
  }

  private pump(): void {
    while (this.running.size < this.concurrency) {
      const job = this.next();
      if (!job) return;
      const [lane, id] = job;
      const key = FairQueue.key(lane, id);
      this.running.add(key);
      void Promise.resolve()
        .then(() => this.work(lane, id))
        .catch((err) => this.onError(lane, id, err))
        .finally(() => {
          this.running.delete(key);
          // The turn count lasts while the event has work waiting or running, so a run of guests one after
          // another at one event does not reset it to the front of the line each time.
          if (!this.lanes.has(lane) && !this.stats(lane).running) this.served.delete(lane);
          this.pump();
        });
    }
  }
}
