import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { buildChoir, findMazalTov, type ChoirItem } from "@/lib/media/choir";
import { getEvent } from "@/lib/storage/event";
import { DIRS, dataPath, readJson, writeJson } from "@/lib/storage/fs";
import { getSubmission } from "@/lib/storage/submissions";
import { hasMusic, listLabJobs, musicPath, onLabQueue, type LabStatus } from "./jobs";

export type ChoirState = {
  status: LabStatus;
  step?: string;
  error?: string;
  startedAt: string;
  file?: string;
  duration?: number;
  buildSeconds?: number;
  /** Recordings where "mazal tov" was found, in the order they play. */
  included: { id: string; name: string }[];
  /** Recordings left out, and why. */
  skipped: { id: string; name: string; reason: string }[];
};

const STATE = () => dataPath(DIRS.lab, "choir.json");
const DIR = "choir";

export const getChoir = () => readJson<ChoirState>(STATE());

/** Picks every finished lab recording with "mazal tov" in it and queues the montage. */
export async function startChoir(): Promise<ChoirState> {
  const current = await getChoir();
  if (current && (current.status === "pending" || current.status === "running")) return current;
  const event = await getEvent();
  const names = [event.celebrantName, event.celebrantNameEn].filter(Boolean);
  const jobs = (await listLabJobs()).filter((j) => j.status === "done").reverse();
  const state: ChoirState = { status: "pending", step: "בתור", startedAt: new Date().toISOString(), included: [], skipped: [] };
  const items: ChoirItem[] = [];
  for (const j of jobs) {
    const name = j.guestName || "אורח";
    const at = j.words ? findMazalTov(j.words, names) : null;
    if (!j.source || !at) {
      state.skipped.push({ id: j.id, name, reason: j.words ? 'לא נמצא "מזל טוב" בהקלטה' : "תומלל לפני שהיו זמנים למילים" });
      continue;
    }
    const posterRel = j.posterId ? (await getSubmission(j.posterId))?.files.image : undefined;
    items.push({
      input: dataPath(j.input),
      info: {
        duration: j.source.duration,
        video: j.source.kind === "video" && j.source.width && j.source.height ? { width: j.source.width, height: j.source.height } : undefined,
        hasAudio: true,
      },
      ...at,
      name,
      poster: posterRel ? await fs.readFile(dataPath(posterRel)).catch(() => undefined) : undefined,
    });
    state.included.push({ id: j.id, name });
  }
  if (items.length < 2) {
    state.status = "failed";
    state.step = undefined;
    state.error = 'צריך לפחות שתי הקלטות שאומרים בהן "מזל טוב"';
    await writeJson(STATE(), state);
    return state;
  }
  await writeJson(STATE(), state);

  onLabQueue(async () => {
    const t0 = Date.now();
    await writeJson(STATE(), { ...state, status: "running", step: `עורך ${items.length} קולות` });
    try {
      const dir = dataPath(DIRS.lab, DIR);
      await fs.rm(dir, { recursive: true, force: true });
      const clip = await buildChoir({
        dir,
        items,
        celebrant: event.celebrantName,
        footer: event.footer || event.eventTitle,
        lang: "he",
        music: (await hasMusic()) ? dataPath(musicPath()) : undefined,
      });
      await writeJson(STATE(), {
        ...state,
        status: "done",
        step: undefined,
        file: path.posix.join(DIRS.lab, DIR, path.basename(clip.file)),
        duration: clip.duration,
        buildSeconds: Math.round((Date.now() - t0) / 1000),
      });
    } catch (err) {
      console.error("[lab] choir failed", err);
      await writeJson(STATE(), { ...state, status: "failed", step: undefined, error: err instanceof Error ? err.message : String(err) });
    }
  });
  return state;
}
