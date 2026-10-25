import "server-only";
import PQueue from "p-queue";
import { config } from "@/lib/config";
import { listSubmissions, updateSubmission } from "@/lib/storage/submissions";
import type { StageName } from "@/lib/types";
import { runSubmission } from "./run";

// One queue per server process, kept across hot reloads in development.
const globalForQueue = globalThis as unknown as { __genQueue?: PQueue; __queued?: Set<string> };
const queue = (globalForQueue.__genQueue ??= new PQueue({ concurrency: config.concurrency }));
const queued = (globalForQueue.__queued ??= new Set<string>());

export function enqueue(id: string): void {
  if (queued.has(id)) return;
  queued.add(id);
  void queue
    .add(() => runSubmission(id))
    .catch((err) => console.error(`[queue] ${id} crashed`, err))
    .finally(() => queued.delete(id));
}

export function queueStats() {
  return { waiting: queue.size, running: queue.pending };
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
