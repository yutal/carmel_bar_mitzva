import type { Analysis, EventSettings, GuestInput, ImageConcept, SongConcept } from "@/lib/types";

export type ReferenceImage = { name: string; data: Buffer; role: "celebrant" | "guest" };

export interface LlmProvider {
  analyze(input: GuestInput, event: EventSettings): Promise<Analysis>;
  imageConcept(input: GuestInput, analysis: Analysis, event: EventSettings, hasGuestPhoto: boolean): Promise<ImageConcept>;
  songConcept(input: GuestInput, analysis: Analysis, event: EventSettings): Promise<SongConcept>;
}

export interface ImageProvider {
  /** Returns PNG/JPEG bytes. References are passed in the given order. */
  generate(req: { prompt: string; references: ReferenceImage[]; size: "portrait" | "square" }): Promise<Buffer>;
}

export type MusicResult =
  | { kind: "audio"; mp3: Buffer }
  | { kind: "manual" }; // the Suno brief is ready; an organiser produces the track and uploads it

export interface MusicProvider {
  generate(req: { title: string; prompt: string }): Promise<MusicResult>;
}
