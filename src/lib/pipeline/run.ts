import "server-only";
import fs from "node:fs/promises";
import { composeCover, composePoster } from "@/lib/compose/poster";
import { providers } from "@/lib/providers";
import type { ReferenceImage } from "@/lib/providers/types";
import { celebrantPhotoPath, getEvent, listCelebrantPhotos } from "@/lib/storage/event";
import { filePath, getSubmission, saveFile, setStage, updateSubmission } from "@/lib/storage/submissions";
import type { EventSettings, StageName, Submission } from "@/lib/types";

const MAX_CELEBRANT_REFS = 4;

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
    const concept = await providers.llm.imageConcept(s.input, s.analysis!, event, Boolean(guestPhoto));
    s = await updateSubmission(id, (x) => {
      x.imageConcept = concept;
    });
  }

  const references = await celebrantReferences();
  if (guestPhoto) references.push({ name: "guest.jpg", data: guestPhoto, role: "guest" });
  const art = await providers.image.generate({ prompt: s.imageConcept!.imagePrompt, references, size: "portrait", celebrantLook: event.celebrantLook });
  await saveFile(id, "imageRaw", "images", "_raw.png", art);

  const concept = s.imageConcept!;
  const poster = await composePoster(art, {
    style: s.input.imageStyle ?? "movie",
    title: concept.titleHebrew,
    tagline: concept.taglineHebrew,
    coverLines: concept.coverLines ?? [],
    stats: concept.stats ?? [],
    blessing: s.input.blessing,
    sender: `${s.input.fullName}, ${s.input.relationship}`,
    footer: [event.footer, event.eventDate].filter(Boolean).join(" · "),
  });
  await saveFile(id, "image", "images", ".png", poster);
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
      : await providers.image.generate({ prompt: song.coverPrompt, references: await celebrantReferences(), size: "square", celebrantLook: event.celebrantLook });
    const cover = await composeCover(art, song.titleHebrew, `מאת ${s.input.fullName} ל${event.celebrantName}`);
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

async function celebrantReferences(): Promise<ReferenceImage[]> {
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
