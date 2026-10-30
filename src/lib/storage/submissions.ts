import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { config } from "@/lib/config";
import { DIRS, dataPath, ensureDirs, readJson, writeFileAtomic, writeJson } from "./fs";
import { submissionBaseName } from "./naming";
import type { GuestInput, StageName, StageState, Submission, SubmissionFiles } from "@/lib/types";
import { LANG_INFO } from "@/lib/i18n";
import { showsOnScreen } from "@/lib/views";
import { IMAGE_STYLES, MUSIC_STYLES } from "@/lib/types";

const jsonPath = (id: string) => dataPath(DIRS.blessings, `${id}.json`);
const txtPath = (id: string) => dataPath(DIRS.blessings, `${id}.txt`);

/** Serialises read-modify-write per submission inside this process. */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(id, next.catch(() => undefined));
  return next;
}

function stage(status: StageState["status"]): StageState {
  return { status, updatedAt: new Date().toISOString() };
}

async function uniqueId(base: string): Promise<string> {
  for (let i = 1; ; i++) {
    const id = i === 1 ? base : `${base}_${i}`;
    try {
      await fs.access(jsonPath(id));
    } catch {
      return id;
    }
  }
}

const g = globalThis as unknown as { __nextNumber?: Promise<number> };

/** The next running number, counted from the submissions on disk at startup and then kept in memory. */
function nextNumber(): Promise<number> {
  const prev = g.__nextNumber ?? fs.readdir(dataPath(DIRS.blessings)).then((n) => n.filter((f) => f.endsWith(".json")).length);
  const next = prev.then((n) => n + 1);
  g.__nextNumber = next;
  return next;
}

export async function createSubmission(input: GuestInput): Promise<Submission> {
  await ensureDirs();
  const id = await uniqueId(submissionBaseName(input.fullName, new Date()));
  const wantsImage = input.experience === "image" || input.experience === "both";
  const wantsSong = input.experience === "song" || input.experience === "both";
  const submission: Submission = {
    id,
    publicId: randomBytes(12).toString("base64url"),
    number: await nextNumber(),
    createdAt: new Date().toISOString(),
    input,
    hidden: false,
    stages: {
      analysis: stage("pending"),
      ...(wantsImage && { image: stage("pending") }),
      ...(wantsSong && { song: stage("pending") }),
    },
    files: {},
  };
  await save(submission);
  return submission;
}

export async function getSubmission(id: string): Promise<Submission | undefined> {
  if (!/^[\p{L}\p{N}_-]+$/u.test(id)) return undefined;
  return readJson<Submission>(jsonPath(id));
}

export async function listSubmissions(): Promise<Submission[]> {
  await ensureDirs();
  const names = await fs.readdir(dataPath(DIRS.blessings));
  const items = await Promise.all(
    names.filter((n) => n.endsWith(".json")).map((n) => readJson<Submission>(dataPath(DIRS.blessings, n))),
  );
  return items
    .filter((s): s is Submission => Boolean(s))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A guest's name reduced to letters and digits, so "Dana  Cohen" and "dana cohen" count as one person. */
export function nameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** How many more creations this name may make; null when there is no limit. */
export async function remainingFor(name: string): Promise<number | null> {
  const max = config.maxCreationsPerGuest;
  if (!max) return null;
  const key = nameKey(name);
  // A blessing on its own costs nothing to make, so it does not count towards the limit.
  const used = (await listSubmissions()).filter((s) => nameKey(s.input.fullName) === key && s.input.experience !== "blessing" && !s.test).length;
  return Math.max(0, max - used);
}

// Every guest's result page asks for its submission every few seconds; remember where each public id lives
// instead of reading every record on each request.
const byPublicId = new Map<string, string>();

/** A guest's link stops working this many hours after the creation; the organiser keeps everything in /admin. */
function linkExpired(s: Submission): boolean {
  return config.resultLinkHours > 0 && Date.now() - Date.parse(s.createdAt) > config.resultLinkHours * 3600_000;
}

/**
 * The submission behind a guest's link, or nothing once the link has expired.
 * `forScreen` still finds a creation that is shown on the hall screen, so the slideshow keeps its images.
 */
export async function findByPublicId(publicId: string, opts: { forScreen?: boolean } = {}): Promise<Submission | undefined> {
  const s = await lookupPublicId(publicId);
  if (!s) return undefined;
  if (!linkExpired(s)) return s;
  return opts.forScreen && showsOnScreen(s) ? s : undefined;
}

async function lookupPublicId(publicId: string): Promise<Submission | undefined> {
  const known = byPublicId.get(publicId);
  if (known) {
    const s = await getSubmission(known);
    if (s?.publicId === publicId) return s;
  }
  const found = (await listSubmissions()).find((s) => s.publicId === publicId);
  if (found) byPublicId.set(publicId, found.id);
  return found;
}

export function updateSubmission(
  id: string,
  mutate: (s: Submission) => void,
): Promise<Submission> {
  return withLock(id, async () => {
    const current = await getSubmission(id);
    if (!current) throw new Error(`Submission ${id} not found`);
    mutate(current);
    await save(current);
    return current;
  });
}

export function setStage(id: string, name: StageName, status: StageState["status"], error?: string) {
  return updateSubmission(id, (s) => {
    s.stages[name] = { ...stage(status), ...(error && { error }) };
  });
}

/** Saves a binary artefact under the submission's base name and records it. */
export async function saveFile(
  id: string,
  key: keyof SubmissionFiles,
  dir: keyof typeof DIRS,
  suffix: string,
  data: Buffer | string,
): Promise<string> {
  const rel = `${DIRS[dir]}/${id}${suffix}`;
  await writeFileAtomic(dataPath(rel), data);
  await updateSubmission(id, (s) => {
    s.files[key] = rel;
  });
  return rel;
}

export function filePath(rel: string): string {
  return dataPath(rel);
}

export async function removeFile(rel: string): Promise<void> {
  await fs.rm(dataPath(rel), { force: true });
}

async function save(s: Submission): Promise<void> {
  await writeJson(jsonPath(s.id), s);
  await writeFileAtomic(txtPath(s.id), renderText(s));
}

/** The human-readable record that stays with the memory album. */
function renderText(s: Submission): string {
  const { input } = s;
  const lines = [
    `שם: ${input.fullName}`,
    `קשר לחוגג: ${input.relationship}`,
    `תאריך: ${new Date(s.createdAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`,
    `חוויה: ${{ image: "תמונה", song: "שיר", both: "תמונה ושיר", blessing: "ברכה בלבד" }[input.experience]}`,
    `סגנון: ${IMAGE_STYLES[input.imageStyle ?? "movie"].label}`,
    `שפה: ${LANG_INFO[input.lang ?? "he"].label}`,
    `הסכמה למסך באולם: ${input.consentScreen ? "כן" : "לא"}`,
    `הסכמה לפרסום ושיווק: ${input.consentMarketing ? "כן" : "לא"}`,
    "",
    "מה הכי אוהבים לעשות יחד:",
    input.together || "-",
    "",
    "זיכרון משותף:",
    input.memory || "-",
    "",
    "במה החוגג הכי טוב:",
    input.talent || "-",
    "",
    "הברכה:",
    input.blessing,
  ];
  if (s.imageConcept) {
    lines.push(
      "",
      "--- הקונספט של התמונה ---",
      `שם הסרט: ${s.imageConcept.titleHebrew}`,
      `סלוגן: ${s.imageConcept.taglineHebrew}`,
      `ז'אנר: ${s.imageConcept.genre}`,
      `למה: ${s.imageConcept.rationale}`,
    );
  }
  if (s.songConcept) {
    lines.push(
      "",
      "--- השיר ---",
      `שם השיר: ${s.songConcept.titleHebrew}`,
      `סגנון שנבחר: ${MUSIC_STYLES[input.musicStyle]}`,
      `תיאור ל-Suno: ${s.songConcept.sunoPrompt}`,
    );
  }
  return lines.join("\n") + "\n";
}
