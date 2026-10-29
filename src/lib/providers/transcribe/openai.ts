import "server-only";
import fs from "node:fs";
import { config } from "@/lib/config";
import { openai } from "@/lib/providers/openai-client";
import type { TranscribeProvider } from "@/lib/providers/types";
import { recordUsage } from "@/lib/usage";

export const openAiTranscribe: TranscribeProvider = {
  async transcribe(audioFile, hint, lang) {
    const res = await openai().audio.transcriptions.create({
      file: fs.createReadStream(audioFile),
      model: config.transcribeModel,
      // Naming the language avoids short Hebrew clips being heard as Arabic or Yiddish.
      language: lang ?? "he",
      prompt: hint,
      response_format: "verbose_json",
      // Word times cost nothing extra; they drive word-by-word captions and the "mazal tov" choir.
      timestamp_granularities: ["word", "segment"],
    });
    await recordUsage("transcribe", config.transcribeModel, { seconds: res.duration });
    return {
      duration: res.duration,
      segments: (res.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })).filter((s) => s.text),
      words: (res.words ?? []).map((w) => ({ word: w.word.trim(), start: w.start, end: w.end })).filter((w) => w.word),
    };
  },
};
