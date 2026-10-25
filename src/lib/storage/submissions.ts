import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { DIRS, dataPath, ensureDirs, readJson, writeFileAtomic, writeJson } from "./fs";
import { submissionBaseName } from "./naming";
import type { GuestInput, StageName, StageState, Submission, SubmissionFiles } from "@/lib/types";
import { MUSIC_STYLES } from "@/lib/types";

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

export async function createSubmission(input: GuestInput): Promise<Submission> {
  await ensureDirs();
  const id = await uniqueId(submissionBaseName(input.fullName, new Date()));
  const wantsImage = input.experience !== "song";
  const wantsSong = input.experience !== "image";
  const submission: Submission = {
    id,
    publicId: randomBytes(12).toString("base64url"),
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

export async function findByPublicId(publicId: string): Promise<Submission | undefined> {
  return (await listSubmissions()).find((s) => s.publicId === publicId);
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
    `חוויה: ${{ image: "תמונה", song: "שיר", both: "תמונה ושיר" }[input.experience]}`,
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
