import type { Analysis, EventSettings, GuestInput, ImageConcept, SongConcept } from "@/lib/types";

/** `label` replaces the default one-line description of the image in the prompt. */
export type ReferenceImage = { name: string; data: Buffer; role: "celebrant" | "guest"; label?: string };

export interface LlmProvider {
  analyze(input: GuestInput, event: EventSettings): Promise<Analysis>;
  /** The guest photo, when given, is shown to the model so it can see who is in it. */
  imageConcept(input: GuestInput, analysis: Analysis, event: EventSettings, guestPhoto?: Buffer): Promise<ImageConcept>;
  songConcept(input: GuestInput, analysis: Analysis, event: EventSettings): Promise<SongConcept>;
}

export interface ImageProvider {
  /** Returns PNG/JPEG bytes. References are passed in the given order. */
  generate(req: { prompt: string; references: ReferenceImage[]; size: "portrait" | "square"; celebrantLook?: string }): Promise<Buffer>;
}

export type MusicResult =
  | { kind: "audio"; mp3: Buffer }
  | { kind: "manual" }; // the Suno brief is ready; an organiser produces the track and uploads it

export interface MusicProvider {
  generate(req: { title: string; prompt: string }): Promise<MusicResult>;
}
