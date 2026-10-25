import "server-only";
import { openAiImage } from "./image/openai";
import { openAiLlm } from "./llm/openai";
import { mockImage, mockLlm } from "./mock";
import { manualMusic } from "./music/manual";
import type { ImageProvider, LlmProvider, MusicProvider } from "./types";

const useMock = process.env.AI_PROVIDER === "mock";

/** Single place to swap providers. Add new ones next to these and select them here. */
export const providers: { llm: LlmProvider; image: ImageProvider; music: MusicProvider } = {
  llm: useMock ? mockLlm : openAiLlm,
  image: useMock ? mockImage : openAiImage,
  music: manualMusic,
};
