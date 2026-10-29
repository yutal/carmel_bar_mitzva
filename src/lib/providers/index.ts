import "server-only";
import { openAiImage } from "./image/openai";
import { openAiLlm } from "./llm/openai";
import { mockImage, mockLlm, mockTranscribe } from "./mock";
import { manualMusic } from "./music/manual";
import { openAiTranscribe } from "./transcribe/openai";
import type { ImageProvider, LlmProvider, MusicProvider, TranscribeProvider } from "./types";

const useMock = process.env.AI_PROVIDER === "mock";

/** Single place to swap providers. Add new ones next to these and select them here. */
export const providers: { llm: LlmProvider; image: ImageProvider; music: MusicProvider; transcribe: TranscribeProvider } = {
  llm: useMock ? mockLlm : openAiLlm,
  image: useMock ? mockImage : openAiImage,
  music: manualMusic,
  transcribe: useMock ? mockTranscribe : openAiTranscribe,
};
