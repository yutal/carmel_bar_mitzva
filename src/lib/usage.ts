import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs/promises";
import { dataPath, readJson, writeJson } from "@/lib/storage/fs";

/**
 * Every OpenAI call the app makes is logged to usage.jsonl with an estimated cost, so the organiser
 * can see the spend and how much of the prepaid balance is left during the event. The estimate uses
 * list prices; OPENAI_PRICES (JSON, same shape as PRICES) overrides them when they change.
 */

/** USD per 1M tokens; transcription in USD per minute. */
type Price = { input: number; cachedInput?: number; imageInput?: number; cachedImageInput?: number; output: number; perMinute?: number };

const DEFAULT_PRICES: Record<string, Price> = {
  "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
  "gpt-image-2": { input: 2.5, cachedInput: 0.625, imageInput: 4, cachedImageInput: 1, output: 15 },
  "whisper-1": { input: 0, output: 0, perMinute: 0.006 },
};

function prices(): Record<string, Price> {
  try {
    return { ...DEFAULT_PRICES, ...(JSON.parse(process.env.OPENAI_PRICES ?? "{}") as Record<string, Price>) };
  } catch {
    return DEFAULT_PRICES;
  }
}

export type UsageKind = "analysis" | "image_concept" | "song_concept" | "face_map" | "clip_plan" | "image" | "transcribe" | "qa_check";

export type Usage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  imageInputTokens?: number;
  outputTokens?: number;
  seconds?: number;
};

export type UsageEntry = Usage & { at: string; kind: UsageKind; model: string; costUsd: number; submissionId?: string };

export function estimateCost(model: string, u: Usage): number {
  const p = prices()[model];
  if (!p) return 0;
  const cached = u.cachedInputTokens ?? 0;
  const image = u.imageInputTokens ?? 0;
  const text = Math.max(0, (u.inputTokens ?? 0) - cached - image);
  const perM =
    text * p.input +
    cached * (p.cachedInput ?? p.input) +
    image * (p.imageInput ?? p.input) +
    (u.outputTokens ?? 0) * p.output;
  return perM / 1e6 + ((u.seconds ?? 0) / 60) * (p.perMinute ?? 0);
}

// The pipeline runs each submission inside this context, so provider calls know whom they were for.
const context = new AsyncLocalStorage<{ submissionId: string }>();
export const withSubmission = <T>(submissionId: string, fn: () => Promise<T>) => context.run({ submissionId }, fn);

const usageFile = () => dataPath("usage.jsonl");

export async function recordUsage(kind: UsageKind, model: string, usage: Usage): Promise<void> {
  const entry: UsageEntry = {
    at: new Date().toISOString(),
    kind,
    model,
    ...usage,
    costUsd: Number(estimateCost(model, usage).toFixed(5)),
    submissionId: context.getStore()?.submissionId,
  };
  // Losing a log line must never fail a guest's poster.
  await fs.appendFile(usageFile(), JSON.stringify(entry) + "\n").catch((err) => console.error("[usage]", err));
}

export async function readUsage(): Promise<UsageEntry[]> {
  const raw = await fs.readFile(usageFile(), "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as UsageEntry];
      } catch {
        return [];
      }
    });
}

/** The OpenAI balance the organiser read off the billing page, and when. Spend after that time is subtracted from it. */
export type Balance = { amountUsd: number; setAt: string };

const balanceFile = () => dataPath("openai-balance.json");
export const getBalance = () => readJson<Balance>(balanceFile());
export const saveBalance = (b: Balance) => writeJson(balanceFile(), b);

/**
 * Actual billed spend from OpenAI's Costs API. Needs an organisation admin key (OPENAI_ADMIN_KEY),
 * not the regular API key; OpenAI updates it with a delay of minutes to hours.
 */
export async function officialCosts(days = 30): Promise<{ todayUsd: number; periodUsd: number; days: number } | { error: string } | null> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) return null;
  const now = Math.floor(Date.now() / 1000);
  const url = `https://api.openai.com/v1/organization/costs?start_time=${now - days * 86400}&bucket_width=1d&limit=${days + 1}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { error: `OpenAI Costs API: HTTP ${res.status}` };
    const body = (await res.json()) as { data: { start_time: number; results: { amount?: { value?: number } }[] }[] };
    const sum = (b: (typeof body.data)[number]) => b.results.reduce((t, r) => t + (r.amount?.value ?? 0), 0);
    const buckets = [...body.data].sort((a, b) => a.start_time - b.start_time);
    return {
      todayUsd: buckets.length ? sum(buckets[buckets.length - 1]) : 0,
      periodUsd: buckets.reduce((t, b) => t + sum(b), 0),
      days,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
