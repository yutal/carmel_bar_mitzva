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
  imageStyleBrief,
  songStyleHint,
} from "@/lib/prompts";
import { AnalysisSchema, ImageConceptSchema, SongConceptSchema } from "@/lib/types";

async function structured<S extends z.ZodType>(
  schema: S,
  name: string,
  system: string,
  user: string,
  image?: Buffer,
): Promise<z.infer<S>> {
  const response = await openai().responses.parse({
    model: config.llmModel,
    instructions: system,
    input: image
      ? [
          {
            role: "user",
            content: [
              { type: "input_text", text: user },
              { type: "input_image", image_url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "high" },
            ],
          },
        ]
      : user,
    text: { format: zodTextFormat(schema, name) },
  });
  if (!response.output_parsed) throw new Error(`LLM returned no ${name}`);
  return response.output_parsed as z.infer<S>;
}

export const openAiLlm: LlmProvider = {
  analyze(input, event) {
    return structured(AnalysisSchema, "analysis", ANALYSIS_SYSTEM, guestContext(input, event));
  },
  imageConcept(input, analysis, event, guestPhoto) {
    const user = [
      guestContext(input, event),
      "",
      `Analysis:\n${analysisSummary(analysis)}`,
      "",
      event.celebrantLook ? `How the celebrant looks: ${event.celebrantLook}` : "",
      guestPhoto ? "The guest photo is attached." : "NO guest photo is provided.",
      "",
      imageStyleBrief(input.imageStyle ?? "movie"),
    ].join("\n");
    return structured(ImageConceptSchema, "image_concept", IMAGE_CONCEPT_SYSTEM, user, guestPhoto);
  },
  songConcept(input, analysis, event) {
    const user = [guestContext(input, event), "", `Analysis:\n${analysisSummary(analysis)}`, "", songStyleHint(input)].join("\n");
    return structured(SongConceptSchema, "song_concept", SONG_CONCEPT_SYSTEM, user);
  },
};
