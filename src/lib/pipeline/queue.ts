import "server-only";
import { config } from "@/lib/config";
import { forEachEvent } from "@/lib/platform/events";
import { currentSlug, withEvent } from "@/lib/platform/scope";
import { listSubmissions, updateSubmission } from "@/lib/storage/submissions";
import type { StageName } from "@/lib/types";
import { withSubmission } from "@/lib/usage";
import { FairQueue } from "./fair-queue";
import { runSubmission } from "./run";

// One queue per server process for all events, kept across hot reloads in development. It takes turns between
// events, so ten events on the same night share the AI slots fairly.
const g = globalThis as unknown as { __genQueue?: FairQueue; __runSeconds?: number[] };
// How long the last runs took, for the wait estimate shown to guests.
const runSeconds = (g.__runSeconds ??= []);
const queue = (g.__genQueue ??= new FairQueue(
  config.concurrency,
  async (slug, id) => {
    const started = Date.now();
    try {
      await withEvent(slug, () => withSubmission(id, () => runSubmission(id)));
    } finally {
      runSeconds.push((Date.now() - started) / 1000);
      if (runSeconds.length > 20) runSeconds.shift();
    }
  },
  (slug, id, err) => console.error(`[queue] ${slug}/${id} crashed`, err),
));

/** Queues a submission of the current event. */
export function enqueue(id: string): void {
  queue.add(currentSlug(), id);
}

/** Waiting and running creations: of the current event when called inside one, otherwise of all events. */
export function queueStats(scope: "event" | "all" = "event") {
  return scope === "all" ? queue.stats() : queue.stats(currentSlug());
}

/** Typical time for one creation: the median of recent runs, or 70 seconds before there are any. */
function typicalRunSeconds(): number {
  if (!runSeconds.length) return 70;
  const sorted = [...runSeconds].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Where a submission stands in the queue: how many creations (of every event) start before it and roughly when it
 * will be ready. Null when it is not waiting (already running, or done).
 */
export function queuePosition(id: string): { ahead: number; etaSeconds: number } | null {
  const ahead = queue.ahead(currentSlug(), id);
  if (ahead === null) return null;
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

/** Picks up work interrupted by a restart, in every event. */
export async function resumePending(): Promise<void> {
  await forEachEvent(async () => {
    for (const s of await listSubmissions()) {
      if (Object.values(s.stages).some((st) => st?.status === "pending" || st?.status === "running")) enqueue(s.id);
    }
  });
}
