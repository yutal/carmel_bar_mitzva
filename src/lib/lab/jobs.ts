import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import PQueue from "p-queue";
import { config } from "@/lib/config";
import { buildClip, type ClipRange } from "@/lib/media/clip";
import { probe, run } from "@/lib/media/ffmpeg";
import { providers } from "@/lib/providers";
import { getEvent } from "@/lib/storage/event";
import { DIRS, dataPath, readJson, writeJson } from "@/lib/storage/fs";
import { getSubmission } from "@/lib/storage/submissions";
import type { Lang } from "@/lib/i18n";
import { celebrantNameIn } from "@/lib/prompts";
import type { ClipPlan, TranscriptSegment } from "@/lib/types";

/** Longest upload the lab accepts; guests will be asked for up to a minute. */
const MAX_SOURCE_SECONDS = 5 * 60;
export const MAX_LAB_UPLOAD_BYTES = 200 * 1024 * 1024;

export type LabStatus = "pending" | "running" | "done" | "failed";

export type LabJob = {
  id: string;
  createdAt: string;
  status: LabStatus;
  /** What the job is doing right now, in Hebrew, for the lab page. */
  step?: string;
  error?: string;
  guestName: string;
  /** Language spoken; also used for the clip's cards. */
  lang: Lang;
  posterId?: string;
  input: string;
  source?: { kind: "video" | "audio"; duration: number; width?: number; height?: number };
  transcript?: TranscriptSegment[];
  plan?: { titleHebrew: string; quoteHebrew: string; ranges: ClipRange[] };
  clip?: { file: string; duration: number };
  withMusic?: boolean;
  /** Seconds each step took, to estimate the load during the event. */
  timings: Record<string, number>;
};

const rel = (...p: string[]) => path.posix.join(DIRS.lab, ...p);
const jobFile = (id: string) => dataPath(DIRS.lab, id, "job.json");
const MUSIC = rel("music.m4a");

const g = globalThis as unknown as { __labQueue?: PQueue };
// One at a time: a clip uses the whole CPU for a few seconds.
const queue = (g.__labQueue ??= new PQueue({ concurrency: 1 }));

export async function getLabJob(id: string): Promise<LabJob | undefined> {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return undefined;
  return readJson<LabJob>(jobFile(id));
}

export async function listLabJobs(): Promise<LabJob[]> {
  const names = await fs.readdir(dataPath(DIRS.lab)).catch(() => [] as string[]);
  const jobs = await Promise.all(names.map((n) => getLabJob(n).catch(() => undefined)));
  return jobs.filter((j): j is LabJob => Boolean(j)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function update(id: string, fn: (j: LabJob) => void): Promise<LabJob> {
  const job = await getLabJob(id);
  if (!job) throw new Error("Lab job not found");
  fn(job);
  await writeJson(jobFile(id), job);
  return job;
}

export async function createLabJob(file: File, guestName: string, lang: Lang, posterId?: string): Promise<LabJob> {
  const id = `${new Date().toISOString().slice(0, 10)}_${randomBytes(4).toString("hex")}`;
  const ext = (path.extname(file.name).toLowerCase().match(/^\.[a-z0-9]{1,5}$/)?.[0]) ?? (file.type.startsWith("video") ? ".mp4" : ".m4a");
  const input = rel(id, `input${ext}`);
  await fs.mkdir(dataPath(DIRS.lab, id), { recursive: true });
  await pipeline(Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream), createWriteStream(dataPath(input)));
  const job: LabJob = {
    id,
    createdAt: new Date().toISOString(),
    status: "pending",
    step: "בתור",
    guestName: guestName.trim().slice(0, 60),
    lang,
    posterId: posterId || undefined,
    input,
    timings: {},
  };
  await writeJson(jobFile(id), job);
  enqueueLab(id);
  return job;
}

export async function deleteLabJob(id: string): Promise<void> {
  if (!(await getLabJob(id))) return;
  await fs.rm(dataPath(DIRS.lab, id), { recursive: true, force: true });
}

export function enqueueLab(id: string): void {
  void queue.add(() => processJob(id)).catch((err) => console.error(`[lab] ${id} crashed`, err));
}

export async function resumeLab(): Promise<void> {
  for (const j of await listLabJobs()) if (j.status === "pending" || j.status === "running") enqueueLab(j.id);
}

/** Turns the model's segment ranges into padded, ordered, non-overlapping time ranges within the length cap. */
export function planRanges(plan: ClipPlan | undefined, segments: TranscriptSegment[], duration: number, maxSeconds: number): ClipRange[] {
  const whole = [{ start: 0, end: Math.min(duration, maxSeconds) }];
  if (!plan || !segments.length) return whole;
  const last = segments.length - 1;
  const clamp = (i: number) => Math.min(last, Math.max(0, i));
  const picked = plan.ranges
    .map((r) => [clamp(Math.min(r.first, r.last)), clamp(Math.max(r.first, r.last))] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: ClipRange[] = [];
  let used = 0;
  for (const [first, lastIdx] of picked) {
    let start = Math.max(0, segments[first].start - 0.15);
    let end = Math.min(duration, segments[lastIdx].end + 0.3);
    const prev = out.at(-1);
    if (prev && start <= prev.end + 0.1) {
      used -= prev.end - prev.start;
      start = prev.start;
      end = Math.max(end, prev.end);
      out.pop();
    }
    end = Math.min(end, start + (maxSeconds - used));
    if (end - start < 0.5) break;
    out.push({ start, end });
    used += end - start;
  }
  return out.length ? out : whole;
}

async function timed<T>(id: string, step: string, label: string, fn: () => Promise<T>): Promise<T> {
  await update(id, (j) => {
    j.status = "running";
    j.step = label;
  });
  const t0 = Date.now();
  const result = await fn();
  await update(id, (j) => {
    j.timings[step] = Math.round((Date.now() - t0) / 100) / 10;
  });
  return result;
}

async function processJob(id: string): Promise<void> {
  const job = await getLabJob(id);
  if (!job) return;
  const dir = dataPath(DIRS.lab, id);
  const input = dataPath(job.input);
  try {
    const event = await getEvent();
    const info = await timed(id, "probe", "בודק את הקובץ", () => probe(input));
    if (!info.hasAudio && !info.video) throw new Error("הקובץ לא נראה כמו וידאו או הקלטה");
    if (info.duration > MAX_SOURCE_SECONDS) throw new Error("הקובץ ארוך מ-5 דקות");
    await update(id, (j) => {
      j.source = { kind: info.video ? "video" : "audio", duration: info.duration, ...info.video };
    });

    let segments: TranscriptSegment[] = [];
    if (info.hasAudio) {
      const audio = path.join(dir, "audio.mp3");
      await timed(id, "extract", "מחלץ את הקול", () =>
        run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", audio]),
      );
      const lang = job.lang ?? "he";
      const name = celebrantNameIn(event, lang);
      const hint = lang === "en" ? `A Bar Mitzvah blessing for ${name}. Mazal tov, ${name}! ${job.guestName}` : `ברכה לבר המצווה של ${name}. מזל טוב ${name}! ${job.guestName}`;
      segments = (await timed(id, "transcribe", "מתמלל", () => providers.transcribe.transcribe(audio, hint, lang))).segments;
      await update(id, (j) => {
        j.transcript = segments;
      });
    }

    const plan = segments.length
      ? await timed(id, "plan", "בוחר את הקטעים החזקים", () =>
          providers.llm.clipPlan(segments, { guestName: job.guestName, celebrantName: event.celebrantName, maxSeconds: config.clipMaxSeconds }),
        )
      : undefined;
    const ranges = planRanges(plan, segments, info.duration, config.clipMaxSeconds);
    await update(id, (j) => {
      j.plan = { titleHebrew: plan?.titleHebrew ?? "", quoteHebrew: plan?.quoteHebrew ?? "", ranges };
    });

    const posterRel = job.posterId ? (await getSubmission(job.posterId))?.files.image : undefined;
    const poster = posterRel ? await fs.readFile(dataPath(posterRel)).catch(() => undefined) : undefined;
    const music = (await fs.stat(dataPath(MUSIC)).catch(() => null)) ? dataPath(MUSIC) : undefined;

    const clip = await timed(id, "edit", "עורך את הקליפ", () =>
      buildClip({
        dir,
        input,
        info,
        ranges,
        segments,
        poster,
        title: plan?.titleHebrew ?? "",
        quote: plan?.quoteHebrew ?? "",
        sender: job.guestName || (job.lang === "en" ? "a guest" : "אורח"),
        footer: (job.lang === "en" && event.footerEn) || event.footer || event.eventTitle,
        lang: job.lang ?? "he",
        music,
      }),
    );
    await update(id, (j) => {
      j.status = "done";
      j.step = undefined;
      j.withMusic = Boolean(music);
      j.clip = { file: rel(id, path.basename(clip.file)), duration: clip.duration };
    });
  } catch (err) {
    console.error(`[lab] ${id} failed`, err);
    await update(id, (j) => {
      j.status = "failed";
      j.step = undefined;
      j.error = err instanceof Error ? err.message : String(err);
    }).catch(() => undefined);
  }
}

export async function hasMusic(): Promise<boolean> {
  return Boolean(await fs.stat(dataPath(MUSIC)).catch(() => null));
}

export const musicPath = () => MUSIC;

/** Stores background music for the clips, re-encoded so any phone or desktop format works. */
export async function setMusic(file: File): Promise<void> {
  await fs.mkdir(dataPath(DIRS.lab), { recursive: true });
  const tmp = dataPath(DIRS.lab, `music-upload-${randomBytes(4).toString("hex")}`);
  try {
    await pipeline(Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream), createWriteStream(tmp));
    const info = await probe(tmp);
    if (!info.hasAudio) throw new Error("בקובץ אין שמע");
    await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-vn", "-t", "600", "-c:a", "aac", "-b:a", "160k", dataPath(MUSIC)]);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

export async function removeMusic(): Promise<void> {
  await fs.rm(dataPath(MUSIC), { force: true });
}
