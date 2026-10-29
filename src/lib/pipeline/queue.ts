import "server-only";
import PQueue from "p-queue";
import { config } from "@/lib/config";
import { listSubmissions, updateSubmission } from "@/lib/storage/submissions";
import type { StageName } from "@/lib/types";
import { withSubmission } from "@/lib/usage";
import { runSubmission } from "./run";

// One queue per server process, kept across hot reloads in development.
const g = globalThis as unknown as { __genQueue?: PQueue; __queued?: Set<string>; __running?: Set<string>; __runSeconds?: number[] };
const queue = (g.__genQueue ??= new PQueue({ concurrency: config.concurrency }));
// In enqueue order, which is the order p-queue runs them in.
const queued = (g.__queued ??= new Set<string>());
const running = (g.__running ??= new Set<string>());
// How long the last runs took, for the wait estimate shown to guests.
const runSeconds = (g.__runSeconds ??= []);

export function enqueue(id: string): void {
  if (queued.has(id)) return;
  queued.add(id);
  void queue
    .add(async () => {
      running.add(id);
      const started = Date.now();
      try {
        await withSubmission(id, () => runSubmission(id));
      } finally {
        running.delete(id);
        runSeconds.push((Date.now() - started) / 1000);
        if (runSeconds.length > 20) runSeconds.shift();
      }
    })
    .catch((err) => console.error(`[queue] ${id} crashed`, err))
    .finally(() => queued.delete(id));
}

export function queueStats() {
  return { waiting: queue.size, running: queue.pending };
}

/** Typical time for one creation: the median of recent runs, or 70 seconds before there are any. */
function typicalRunSeconds(): number {
  if (!runSeconds.length) return 70;
  const sorted = [...runSeconds].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Where a submission stands in the queue: how many creations wait ahead of it and roughly when it will be
 * ready. Null when it is not waiting (already running, or done).
 */
export function queuePosition(id: string): { ahead: number; etaSeconds: number } | null {
  if (!queued.has(id) || running.has(id)) return null;
  let ahead = 0;
  for (const other of queued) {
    if (other === id) break;
    if (!running.has(other)) ahead++;
  }
  // Each slot frees up as a running creation finishes; ours then takes one full run.
  const rounds = Math.floor(ahead / config.concurrency) + 1;
  return { ahead, etaSeconds: Math.round((rounds + 0.5) * typicalRunSeconds()) };
}

/** Marks a stage for another run. newConcept=false keeps the concept and only redraws / rewrites output. */
export async function regenerate(id: string, stage: StageName, newConcept: boolean): Promise<void> {
  await updateSubmission(id, (s) => {
    if (!s.stages[stage]) throw new Error(`Stage ${stage} is not part of this submission`);
    s.stages[stage] = { status: "pending", updatedAt: new Date().toISOString() };
    if (stage === "analysis") {
      delete s.analysis;
      delete s.imageConcept;
      delete s.songConcept;
      for (const other of ["image", "song"] as const) {
        if (s.stages[other]) s.stages[other] = { status: "pending", updatedAt: new Date().toISOString() };
      }
    }
    if (newConcept && stage === "image") delete s.imageConcept;
    if (newConcept && stage === "song") delete s.songConcept;
  });
  enqueue(id);
}

/** Picks up work interrupted by a restart. */
export async function resumePending(): Promise<void> {
  for (const s of await listSubmissions()) {
    if (Object.values(s.stages).some((st) => st?.status === "pending" || st?.status === "running")) enqueue(s.id);
  }
}
