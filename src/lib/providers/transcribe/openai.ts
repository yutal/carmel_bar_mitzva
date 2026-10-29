import "server-only";
import fs from "node:fs";
import { config } from "@/lib/config";
import { openai } from "@/lib/providers/openai-client";
import type { TranscribeProvider } from "@/lib/providers/types";

export const openAiTranscribe: TranscribeProvider = {
  async transcribe(audioFile, hint) {
    const res = await openai().audio.transcriptions.create({
      file: fs.createReadStream(audioFile),
      model: config.transcribeModel,
      language: "he",
      prompt: hint,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });
    return {
      duration: res.duration,
      segments: (res.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })).filter((s) => s.text),
    };
  },
};
