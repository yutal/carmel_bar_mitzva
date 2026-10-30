import "server-only";
import fs from "node:fs/promises";
import { composeCover, composePoster } from "@/lib/compose/poster";
import { celebrantNameIn } from "@/lib/prompts";
import { buildCoverPrompt, buildImagePrompt, castMismatch, headCount, sendsGuestPhoto, type Cast } from "@/lib/prompts/image";
import { providers } from "@/lib/providers";
import type { ReferenceImage } from "@/lib/providers/types";
import { celebrantPhotoPath, getEvent, listCelebrantPhotos } from "@/lib/storage/event";
import { filePath, getSubmission, saveFile, setStage, updateSubmission } from "@/lib/storage/submissions";
import type { EventSettings, FaceBox, GuestInput, ImageConcept, StageName, Submission } from "@/lib/types";

const MAX_CELEBRANT_REFS = 5;

function needsWork(s: Submission, stage: StageName): boolean {
  const st = s.stages[stage]?.status;
  return st === "pending" || st === "running";
}

/** Runs every stage that is still pending. Safe to call again after a crash or for a regeneration. */
export async function runSubmission(id: string): Promise<void> {
  let s = await getSubmission(id);
  if (!s) return;
  const event = await getEvent();

  if (needsWork(s, "analysis") || !s.analysis) {
    const ok = await stage(id, "analysis", async () => {
      const analysis = await providers.llm.analyze(s!.input, event);
      await updateSubmission(id, (x) => {
        x.analysis = analysis;
        if (!analysis.isAppropriate) x.hidden = true;
      });
    });
    if (!ok) {
      await failRemaining(id, "הניתוח נכשל");
      return;
    }
    s = (await getSubmission(id))!;
  }

  // Image first: a song-and-image submission reuses the poster art for its cover.
  if (s.stages.image && needsWork(s, "image")) {
    await stage(id, "image", () => runImage(id, event));
    s = (await getSubmission(id))!;
  }
  if (s.stages.song && needsWork(s, "song")) {
    await stage(id, "song", () => runSong(id, event));
  }
}

async function runImage(id: string, event: EventSettings): Promise<void> {
  let s = (await getSubmission(id))!;
  const guestPhoto = s.files.photo && s.input.consentPhoto ? await fs.readFile(filePath(s.files.photo)) : undefined;

  if (!s.imageConcept) {
    const concept = await providers.llm.imageConcept(s.input, event, guestPhoto, await celebrantPhoto());
    s = await updateSubmission(id, (x) => {
      x.imageConcept = concept;
    });
  }

  const { art, faces } = await paintArt({ label: id, input: s.input, concept: s.imageConcept!, guestPhoto, event });
  await saveFile(id, "imageRaw", "images", "_raw.png", art);
  if (faces) {
    await updateSubmission(id, (x) => {
      x.faces = faces;
    });
  }
  await saveFile(id, "image", "images", ".png", await posterFor(art, faces, s.input, s.imageConcept!, event));
}

/** The people the image must show, from the concept's reading of the guest photo. */
export function castOf(concept: ImageConcept, guestPhoto: Buffer | undefined): Cast {
  return {
    guestPeople: guestPhoto ? (concept.guestPhotoPeople ?? []) : [],
    celebrantInGuestPhoto: Boolean(guestPhoto && concept.celebrantInGuestPhoto),
    hasGuestPhoto: Boolean(guestPhoto),
  };
}

/** One photo of the celebrant, for the concept to tell him apart from a guest of his age. */
export async function celebrantPhoto(): Promise<Buffer | undefined> {
  const [first] = await listCelebrantPhotos();
  return first ? fs.readFile(celebrantPhotoPath(first)) : undefined;
}

/** An added or repeated person is the worst mistake, so it gets one more try than a missing one. */
const MAX_REPAINTS = { extra: 2, missing: 1 };

/**
 * Paints the artwork (no text) and finds its faces. When the face count does not match the cast (someone added,
 * repeated or left out), paints again with what went wrong and keeps the closest result.
 */
export async function paintArt(opts: {
  label: string;
  input: GuestInput;
  concept: ImageConcept;
  guestPhoto?: Buffer;
  event: EventSettings;
}): Promise<{ art: Buffer; faces?: FaceBox[]; repainted: boolean }> {
  const style = opts.input.imageStyle ?? "movie";
  const cast = castOf(opts.concept, opts.guestPhoto);
  const references = await celebrantReferences();
  if (opts.guestPhoto && sendsGuestPhoto(cast)) references.push({ name: "guest.jpg", data: opts.guestPhoto, role: "guest" });
  const paint = (retry?: string) =>
    providers.image.generate({
      prompt: buildImagePrompt({ style, scene: opts.concept.imagePrompt, references, cast, celebrantLook: opts.event.celebrantLook, retry }),
      references,
      size: "portrait",
    });
  // Where the faces are, so no title or text lands on someone. A failed lookup falls back to the fixed layout.
  const findFaces = (img: Buffer) =>
    providers.llm.locateFaces(img).catch((err) => {
      console.error(`[pipeline] face lookup failed for ${opts.label}`, err);
      return undefined;
    });

  const n = headCount(cast);
  const off = (f: unknown[] | undefined) => (f ? Math.abs(f.length - n) : Infinity);
  let art = await paint();
  let faces = await findFaces(art);
  let tries = 0;
  for (;;) {
    const mismatch = faces && castMismatch(faces.length, cast);
    if (!mismatch || tries >= MAX_REPAINTS[faces!.length > n ? "extra" : "missing"]) break;
    tries++;
    console.warn(`[pipeline] ${opts.label}: ${faces!.length} faces, expected ${n}; painting again (${tries})`);
    const art2 = await paint(mismatch);
    const faces2 = await findFaces(art2);
    if (off(faces2) > off(faces)) continue;
    art = art2;
    faces = faces2;
  }
  return { art, faces, repainted: tries > 0 };
}

/** The finished poster: the artwork with the title, sign-off and style layout drawn around the faces. */
export function posterFor(art: Buffer, faces: FaceBox[] | undefined, input: GuestInput, concept: ImageConcept, event: EventSettings): Promise<Buffer> {
  const lang = input.lang ?? "he";
  return composePoster(art, {
    style: input.imageStyle ?? "movie",
    title: concept.titleHebrew,
    tagline: concept.taglineHebrew,
    coverLines: concept.coverLines ?? [],
    stats: concept.stats ?? [],
    sender: `${lang === "en" ? "With love," : "באהבה,"} ${input.fullName} · ${input.relationship}`,
    lang,
    masthead: lang === "en" ? celebrantNameIn(event, "en").toUpperCase() : event.celebrantName,
    footer: [(lang === "en" && event.footerEn) || event.footer, event.eventDate].filter(Boolean).join(" · "),
    faces,
  });
}

async function runSong(id: string, event: EventSettings): Promise<void> {
  let s = (await getSubmission(id))!;
  if (!s.songConcept) {
    const concept = await providers.llm.songConcept(s.input, s.analysis!, event);
    s = await updateSubmission(id, (x) => {
      x.songConcept = concept;
    });
  }
  const song = s.songConcept!;
  await saveFile(id, "sunoPrompt", "songs", "_suno.txt", sunoFile(s));

  try {
    const art = s.files.imageRaw
      ? await fs.readFile(filePath(s.files.imageRaw))
      : await coverArt(song.coverPrompt, event);
    const byline = s.input.lang === "en" ? `By ${s.input.fullName} for ${celebrantNameIn(event, "en")}` : `מאת ${s.input.fullName} ל${event.celebrantName}`;
    const cover = await composeCover(art, song.titleHebrew, byline);
    await saveFile(id, "cover", "songs", "_cover.png", cover);
  } catch (err) {
    // A missing cover must not block the song brief.
    console.error(`[pipeline] cover failed for ${id}`, err);
  }

  const music = await providers.music.generate({ title: song.titleHebrew, prompt: song.sunoPrompt });
  if (music.kind === "audio") {
    await saveFile(id, "mp3", "songs", ".mp3", music.mp3);
    return;
  }
  await setStage(id, "song", "awaiting_music");
}

/**
 * The exact head count, for the styles where the image model tends to invent people (a team on a player card,
 * extra characters in an animated film). The other styles are left as they are.
 */
function sunoFile(s: Submission): string {
  const song = s.songConcept!;
  return [
    song.titleHebrew,
    `מאת: ${s.input.fullName} (${s.input.relationship})`,
    "",
    "Song description (Suno):",
    song.sunoPrompt,
    "",
    "הברכה המקורית:",
    s.input.blessing,
    "",
  ].join("\n");
}

async function coverArt(scene: string, event: EventSettings): Promise<Buffer> {
  const references = await celebrantReferences();
  return providers.image.generate({ prompt: buildCoverPrompt(scene, references, event.celebrantLook), references, size: "square" });
}

export async function celebrantReferences(): Promise<ReferenceImage[]> {
  const names = (await listCelebrantPhotos()).slice(0, MAX_CELEBRANT_REFS);
  return Promise.all(
    names.map(async (name) => ({ name, data: await fs.readFile(celebrantPhotoPath(name)), role: "celebrant" as const })),
  );
}

/** Runs one stage with status bookkeeping. Returns false when it failed. */
async function stage(id: string, name: StageName, work: () => Promise<void>): Promise<boolean> {
  await setStage(id, name, "running");
  try {
    await work();
    const s = await getSubmission(id);
    if (s?.stages[name]?.status === "running") await setStage(id, name, "done");
    return true;
  } catch (err) {
    console.error(`[pipeline] ${name} failed for ${id}`, err);
    await setStage(id, name, "failed", errorMessage(err));
    return false;
  }
}

async function failRemaining(id: string, reason: string) {
  const s = await getSubmission(id);
  for (const name of ["image", "song"] as const) {
    if (s?.stages[name] && needsWork(s, name)) await setStage(id, name, "failed", reason);
  }
}

function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 300);
}
