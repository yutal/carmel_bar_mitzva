import type { Lang } from "@/lib/i18n";
import type { Analysis, ClipPlan, EventSettings, FaceBox, GuestInput, ImageConcept, PosterCheck, SongConcept, TranscriptSegment, TranscriptWord } from "@/lib/types";

/** `label` replaces the default one-line description of the image in the prompt. */
export type ReferenceImage = { name: string; data: Buffer; role: "celebrant" | "guest" };

export interface LlmProvider {
  analyze(input: GuestInput, event: EventSettings): Promise<Analysis>;
  /**
   * Built only from the guest's story answers, never from the blessing. The guest photo, when given, is shown
   * to the model so it can see who is in it.
   */
  /** `celebrantPhoto` lets the model tell the celebrant apart from a guest of his age in the guest photo. */
  imageConcept(input: GuestInput, event: EventSettings, guestPhoto?: Buffer, celebrantPhoto?: Buffer): Promise<ImageConcept>;
  songConcept(input: GuestInput, analysis: Analysis, event: EventSettings): Promise<SongConcept>;
  /** Finds every face in generated art, so the poster text can be laid out around them. */
  locateFaces(art: Buffer): Promise<FaceBox[]>;
  /** Checks a finished artwork against the celebrant and the guest photo: head count, copies, style. */
  checkPoster(art: Buffer, celebrant: Buffer, guestPhoto: Buffer | undefined, style: string): Promise<PosterCheck>;
  /** Picks the strongest spoken lines of a guest's video or recording for a short clip. */
  clipPlan(segments: TranscriptSegment[], ctx: { guestName: string; celebrantName: string; maxSeconds: number }): Promise<ClipPlan>;
}

export interface TranscribeProvider {
  /** `hint` carries names and words the speaker is likely to say, to spell them right. */
  transcribe(audioFile: string, hint: string, lang?: Lang): Promise<{ duration: number; segments: TranscriptSegment[]; words?: TranscriptWord[] }>;
}

export interface ImageProvider {
  /** Returns PNG/JPEG bytes. References are passed in the given order; the prompt is complete (see prompts/image.ts). */
  generate(req: { prompt: string; references: ReferenceImage[]; size: "portrait" | "square" }): Promise<Buffer>;
}

export type MusicResult =
  | { kind: "audio"; mp3: Buffer }
  | { kind: "manual" }; // the Suno brief is ready; an organiser produces the track and uploads it

export interface MusicProvider {
  generate(req: { title: string; prompt: string }): Promise<MusicResult>;
}
