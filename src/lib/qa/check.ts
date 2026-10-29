import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import PQueue from "p-queue";
import { celebrantReferences, castOf, paintArt, posterFor } from "@/lib/pipeline/run";
import { headCount } from "@/lib/prompts/image";
import { STYLE_RENDER } from "@/lib/prompts/styles";
import { providers } from "@/lib/providers";
import { getEvent } from "@/lib/storage/event";
import { dataPath, readJson, writeFileAtomic, writeJson } from "@/lib/storage/fs";
import { IMAGE_STYLES, type GuestInput, type ImageStyle, type PosterCheck } from "@/lib/types";
import type { Lang } from "@/lib/i18n";

/**
 * The style check: paints every chosen style for every photo case and language with the real models, the same
 * way a guest's poster is made, then has a second model count the people. Paid: each case is one or two images
 * plus a few model calls. Runs only when the organiser presses the button in /admin/qa.
 */

export type PhotoCase = "none" | "single" | "group";
export const PHOTO_CASES: PhotoCase[] = ["none", "single", "group"];
const PHOTO_STYLES = new Set<ImageStyle>(["movie", "magazine"]);

export type QaCase = {
  key: string;
  style: ImageStyle;
  lang: Lang;
  photo: PhotoCase;
  status: "pending" | "running" | "done" | "failed";
  expected?: number;
  facesFound?: number;
  repainted?: boolean;
  check?: PosterCheck;
  problems?: string[];
  pass?: boolean;
  poster?: string;
  error?: string;
};

export type QaRun = { id: string; startedAt: string; finishedAt?: string; status: "running" | "done"; cases: QaCase[] };

const DIR = "qa";
const runFile = (id: string) => dataPath(DIR, id, "run.json");
const g = globalThis as unknown as { __qaQueue?: PQueue };
// Two at a time: quick enough, and leaves room for guests if someone runs it during the event.
const queue = (g.__qaQueue ??= new PQueue({ concurrency: 2 }));

const STORY: Record<Lang, Pick<GuestInput, "fullName" | "relationship" | "together" | "memory" | "talent">> = {
  he: { fullName: "בדיקה", relationship: "דוד", together: "משחקים כדורסל בחצר כל שישי", memory: "הפעם שהוא קלע מחצי מגרש וכולם צעקו", talent: "זריקות לסל" },
  en: { fullName: "Test", relationship: "Uncle", together: "Playing basketball in the yard every Friday", memory: "The time he scored from half court and everyone screamed", talent: "Three-pointers" },
};

/** What is wrong with one artwork, in Hebrew; empty when it passes. */
export function problemsOf(check: PosterCheck, expected: number, guests: number, style: ImageStyle): string[] {
  const p: string[] = [];
  if (check.celebrantCopies !== 1) p.push(check.celebrantCopies === 0 ? "כרמל לא מופיע" : `כרמל מופיע ${check.celebrantCopies} פעמים`);
  if (check.extraPeople > 0) p.push(`${check.extraPeople} דמויות שלא היו בתמונה`);
  if (check.guestPeopleShown < guests) p.push(`חסרים ${guests - check.guestPeopleShown} מהאנשים שבתמונת האורח`);
  if (check.peopleCount !== expected) p.push(`${check.peopleCount} אנשים במקום ${expected}`);
  if (!PHOTO_STYLES.has(style) && check.photographicFaces > 0) p.push(`${check.photographicFaces} פנים מצולמות בסגנון מצויר`);
  if (!check.styleMatches) p.push("לא בסגנון שנבחר");
  if (check.textInImage) p.push("יש טקסט בתוך הציור");
  return p;
}

export async function getQaRun(id?: string): Promise<QaRun | undefined> {
  if (id) return /^[a-z0-9-]+$/.test(id) ? readJson<QaRun>(runFile(id)) : undefined;
  const ids = (await fs.readdir(dataPath(DIR)).catch(() => [] as string[])).sort();
  return ids.length ? readJson<QaRun>(runFile(ids.at(-1)!)) : undefined;
}

/** Serialises writes to one run's file, since two cases finish at a time. */
let saving = Promise.resolve();
function saveCase(id: string, key: string, patch: Partial<QaCase>): Promise<void> {
  saving = saving.then(async () => {
    const run = await readJson<QaRun>(runFile(id));
    if (!run) return;
    const c = run.cases.find((x) => x.key === key);
    if (c) Object.assign(c, patch);
    if (run.cases.every((x) => x.status === "done" || x.status === "failed")) {
      run.status = "done";
      run.finishedAt = new Date().toISOString();
    }
    await writeJson(runFile(id), run);
  });
  return saving;
}

export async function startQaRun(opts: { styles: ImageStyle[]; langs: Lang[]; photos: Partial<Record<PhotoCase, Buffer>> }): Promise<QaRun> {
  const id = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${randomBytes(2).toString("hex")}`;
  await fs.mkdir(dataPath(DIR, id), { recursive: true });
  const photos: PhotoCase[] = ["none", ...(["single", "group"] as const).filter((p) => opts.photos[p])];
  for (const p of photos) if (opts.photos[p]) await writeFileAtomic(dataPath(DIR, id, `${p}.jpg`), opts.photos[p]!);
  const cases: QaCase[] = opts.styles.flatMap((style) =>
    opts.langs.flatMap((lang) => photos.map((photo) => ({ key: `${style}-${lang}-${photo}`, style, lang, photo, status: "pending" as const }))),
  );
  const run: QaRun = { id, startedAt: new Date().toISOString(), status: "running", cases };
  await writeJson(runFile(id), run);
  for (const c of cases) void queue.add(() => runCase(id, c, opts.photos[c.photo as Exclude<PhotoCase, "none">]));
  return run;
}

async function runCase(id: string, c: QaCase, guestPhoto: Buffer | undefined): Promise<void> {
  await saveCase(id, c.key, { status: "running" });
  try {
    const event = await getEvent();
    const input: GuestInput = {
      ...STORY[c.lang],
      blessing: c.lang === "en" ? "Mazal tov!" : "מזל טוב!",
      experience: "image",
      imageStyle: c.style,
      musicStyle: "auto",
      consentPhoto: Boolean(guestPhoto),
      consentScreen: false,
      consentMarketing: false,
      lang: c.lang,
    };
    const concept = await providers.llm.imageConcept(input, event, guestPhoto);
    const cast = castOf(concept, guestPhoto);
    const { art, faces, repainted } = await paintArt({ label: `qa ${c.key}`, input, concept, guestPhoto, event });
    const rel = path.posix.join(DIR, id, `${c.key}.png`);
    await writeFileAtomic(dataPath(rel), await posterFor(art, faces, input, concept, event));
    const [celebrant] = await celebrantReferences();
    if (!celebrant) throw new Error("אין תמונות של כרמל באדמין");
    const check = await providers.llm.checkPoster(art, celebrant.data, guestPhoto, `${c.style}: ${STYLE_RENDER[c.style]}`);
    const expected = headCount(cast);
    const problems = problemsOf(check, expected, expected - 1, c.style);
    await saveCase(id, c.key, { status: "done", expected, facesFound: faces?.length, repainted, check, problems, pass: problems.length === 0, poster: rel });
  } catch (err) {
    console.error(`[qa] ${c.key} failed`, err);
    await saveCase(id, c.key, { status: "failed", error: err instanceof Error ? err.message : String(err), pass: false });
  }
}

export const ALL_STYLES = Object.keys(IMAGE_STYLES) as ImageStyle[];
