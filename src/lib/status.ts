import "server-only";
import { config } from "@/lib/config";
import { queueStats } from "@/lib/pipeline/queue";
import { listSubmissions } from "@/lib/storage/submissions";
import type { StageName } from "@/lib/types";
import { getBalance, officialCosts, readUsage } from "@/lib/usage";

const round = (n: number) => Math.round(n * 100) / 100;

/** One snapshot of the event for the admin status panel and the event-status skill: creations, failures, queue and money. */
export async function eventStatus() {
  const [subs, usage, balance, official] = await Promise.all([listSubmissions(), readUsage(), getBalance(), officialCosts()]);
  const now = Date.now();
  const hourAgo = now - 3600_000;
  const dayAgo = now - 86400_000;

  const countStage = (stage: StageName) => {
    const c = { done: 0, failed: 0, inProgress: 0, awaitingMusic: 0 };
    for (const s of subs) {
      const st = s.stages[stage]?.status;
      if (st === "done") c.done++;
      else if (st === "failed") c.failed++;
      else if (st === "awaiting_music") c.awaitingMusic++;
      else if (st) c.inProgress++;
    }
    return c;
  };

  const failures = subs.flatMap((s) =>
    (Object.entries(s.stages) as [StageName, NonNullable<(typeof s.stages)[StageName]>][])
      .filter(([, st]) => st.status === "failed")
      .map(([stage, st]) => ({ id: s.id, name: s.input.fullName, stage, error: st.error ?? "", at: st.updatedAt })),
  );

  const sum = (entries: typeof usage) => entries.reduce((t, e) => t + e.costUsd, 0);
  const byKind: Record<string, number> = {};
  for (const e of usage) byKind[e.kind] = (byKind[e.kind] ?? 0) + e.costUsd;
  for (const k of Object.keys(byKind)) byKind[k] = round(byKind[k]);

  // Average cost of a finished poster, counting every call made for it (concept, image, faces, retries).
  const posterIds = new Set(subs.filter((s) => s.stages.image?.status === "done").map((s) => s.id));
  const posterSpend = sum(usage.filter((e) => e.submissionId && posterIds.has(e.submissionId)));
  const perPosterUsd = posterIds.size ? posterSpend / posterIds.size : null;

  let balanceView = null;
  if (balance) {
    const spentSinceUsd = sum(usage.filter((e) => e.at > balance.setAt));
    const remainingUsd = balance.amountUsd - spentSinceUsd;
    const postersLeft = perPosterUsd ? Math.max(0, Math.floor(remainingUsd / perPosterUsd)) : null;
    const queued = queueStats();
    balanceView = {
      ...balance,
      spentSinceUsd: round(spentSinceUsd),
      remainingUsd: round(remainingUsd),
      postersLeft,
      // Low: not enough left for what is in the queue plus another 20 guests.
      low: remainingUsd <= 0 || (postersLeft !== null && postersLeft < queued.waiting + queued.running + 20),
    };
  }

  return {
    at: new Date().toISOString(),
    submissions: {
      total: subs.length,
      lastHour: subs.filter((s) => Date.parse(s.createdAt) > hourAgo).length,
      lastAt: subs.map((s) => s.createdAt).sort().at(-1) ?? null,
      hidden: subs.filter((s) => s.hidden).length,
      analysis: countStage("analysis"),
      posters: countStage("image"),
      songs: countStage("song"),
    },
    failures,
    queue: { ...queueStats(), concurrency: config.concurrency },
    spend: {
      estimated: true,
      totalUsd: round(sum(usage)),
      last24hUsd: round(sum(usage.filter((e) => Date.parse(e.at) > dayAgo))),
      calls: usage.length,
      byKind,
      perPosterUsd: perPosterUsd === null ? null : Math.round(perPosterUsd * 1000) / 1000,
    },
    balance: balanceView,
    openai: official,
  };
}

export type EventStatus = Awaited<ReturnType<typeof eventStatus>>;
