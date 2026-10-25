import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { config } from "@/lib/config";
import { openai } from "@/lib/providers/openai-client";
import type { LlmProvider } from "@/lib/providers/types";
import {
  ANALYSIS_SYSTEM,
  IMAGE_CONCEPT_SYSTEM,
  SONG_CONCEPT_SYSTEM,
  analysisSummary,
  guestContext,
  songStyleHint,
} from "@/lib/prompts";
import { AnalysisSchema, ImageConceptSchema, SongConceptSchema } from "@/lib/types";

async function structured<S extends z.ZodType>(schema: S, name: string, system: string, user: string): Promise<z.infer<S>> {
  const response = await openai().responses.parse({
    model: config.llmModel,
    instructions: system,
    input: user,
    text: { format: zodTextFormat(schema, name) },
  });
  if (!response.output_parsed) throw new Error(`LLM returned no ${name}`);
  return response.output_parsed as z.infer<S>;
}

export const openAiLlm: LlmProvider = {
  analyze(input, event) {
    return structured(AnalysisSchema, "analysis", ANALYSIS_SYSTEM, guestContext(input, event));
  },
  imageConcept(input, analysis, event, hasGuestPhoto) {
    const user = [
      guestContext(input, event),
      "",
      `Analysis:\n${analysisSummary(analysis)}`,
      "",
      hasGuestPhoto ? "A guest photo IS provided." : "NO guest photo is provided.",
    ].join("\n");
    return structured(ImageConceptSchema, "image_concept", IMAGE_CONCEPT_SYSTEM, user);
  },
  songConcept(input, analysis, event) {
    const user = [guestContext(input, event), "", `Analysis:\n${analysisSummary(analysis)}`, "", songStyleHint(input)].join("\n");
    return structured(SongConceptSchema, "song_concept", SONG_CONCEPT_SYSTEM, user);
  },
};
