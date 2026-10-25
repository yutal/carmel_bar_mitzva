import type { MusicProvider } from "@/lib/providers/types";

/**
 * Suno has no official public API. The default provider leaves the track to an
 * organiser: the dashboard shows lyrics + style ready to paste into Suno, and
 * the produced MP3 is uploaded back under the same submission id.
 */
export const manualMusic: MusicProvider = {
  async generate() {
    return { kind: "manual" };
  },
};
