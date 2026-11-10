import "server-only";
import { config } from "@/lib/config";
import { queueStats } from "@/lib/pipeline/queue";
import { forEachEvent } from "@/lib/platform/events";
import { getLicense, licenseUsage } from "@/lib/platform/license";
import { BLOCK_ADMIN, licenseBlock } from "@/lib/platform/license-rules";
import { listSubmissions } from "@/lib/storage/submissions";
import type { StageName } from "@/lib/types";
import { getBalance, officialCosts, readUsage } from "@/lib/usage";

const round = (n: number) => Math.round(n * 100) / 100;

/** Every event's spend, for the platform-wide OpenAI balance. */
async function allUsage() {
  const all: Awaited<ReturnType<typeof readUsage>> = [];
  await forEachEvent(async () => {
    all.push(...(await readUsage()));
  });
  return all;
}

/**
 * One snapshot of the current event for the admin status panel and the event-status skill: creations, failures,
 * queue, licence and, for the owner, money.
 */
export async function eventStatus(opts: { money: boolean }) {
  const [all, usage, license, licUsage] = await Promise.all([listSubmissions(), readUsage(), getLicense(), licenseUsage()]);
  const [balance, official, everyEvent] = opts.money ? await Promise.all([getBalance(), officialCosts(), allUsage()]) : [undefined, null, []];
  // Tests are left out of the counts; their cost still shows in the spend.
  const subs = all.filter((s) => !s.test);
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
    const spentSinceUsd = sum(everyEvent.filter((e) => e.at > balance.setAt));
    const remainingUsd = balance.amountUsd - spentSinceUsd;
    const postersLeft = perPosterUsd ? Math.max(0, Math.floor(remainingUsd / perPosterUsd)) : null;
    const queued = queueStats("all");
    balanceView = {
      ...balance,
      spentSinceUsd: round(spentSinceUsd),
      remainingUsd: round(remainingUsd),
      postersLeft,
      // Low: not enough left for what is in the queue plus another 20 guests.
      low: remainingUsd <= 0 || (postersLeft !== null && postersLeft < queued.waiting + queued.running + 20),
    };
  }

  const block = licenseBlock(license, "blessings", licUsage, now, { creating: true });
  const licenseView = {
    open: !block,
    reason: block ? BLOCK_ADMIN[block] : null,
    startsAt: license.startsAt,
    endsAt: license.endsAt,
    maxCreations: license.maxCreations,
    creationsUsed: licUsage.creations,
    budgetUsedPct: license.budgetUsd ? Math.min(100, Math.round((licUsage.spentUsd / license.budgetUsd) * 100)) : null,
  };

  return {
    at: new Date().toISOString(),
    license: licenseView,
    submissions: {
      total: subs.length,
      lastHour: subs.filter((s) => Date.parse(s.createdAt) > hourAgo).length,
      lastAt: subs.map((s) => s.createdAt).sort().at(-1) ?? null,
      hidden: subs.filter((s) => s.hidden).length,
      tests: all.length - subs.length,
      analysis: countStage("analysis"),
      posters: countStage("image"),
      songs: countStage("song"),
    },
    failures,
    queue: { ...queueStats(), allEvents: queueStats("all"), concurrency: config.concurrency },
    spend: !opts.money ? null : {
      estimated: true,
      totalUsd: round(sum(usage)),
      last24hUsd: round(sum(usage.filter((e) => Date.parse(e.at) > dayAgo))),
      calls: usage.length,
      byKind,
      perPosterUsd: perPosterUsd === null ? null : Math.round(perPosterUsd * 1000) / 1000,
    },
    balance: opts.money ? balanceView : null,
    openai: official,
  };
}

export type EventStatus = Awaited<ReturnType<typeof eventStatus>>;
