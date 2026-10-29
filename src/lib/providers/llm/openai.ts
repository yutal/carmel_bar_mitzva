import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { config } from "@/lib/config";
import { openai } from "@/lib/providers/openai-client";
import type { LlmProvider } from "@/lib/providers/types";
import {
  ANALYSIS_SYSTEM,
  CLIP_PLAN_SYSTEM,
  FACE_MAP_SYSTEM,
  IMAGE_CONCEPT_SYSTEM,
  SONG_CONCEPT_SYSTEM,
  analysisSummary,
  clipPlanInput,
  guestContext,
  imageStyleBrief,
  songStyleHint,
} from "@/lib/prompts";
import sharp from "sharp";
import { AnalysisSchema, ClipPlanSchema, FaceMapSchema, ImageConceptSchema, SongConceptSchema } from "@/lib/types";
import { recordUsage, type UsageKind } from "@/lib/usage";

async function structured<S extends z.ZodType>(
  schema: S,
  name: UsageKind,
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
  await recordUsage(name, config.llmModel, {
    inputTokens: response.usage?.input_tokens,
    cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
    outputTokens: response.usage?.output_tokens,
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
  async locateFaces(art) {
    // A 1024px JPEG is plenty to find faces and keeps the request small.
    const jpeg = await sharp(art).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
    const { faces } = await structured(FaceMapSchema, "face_map", FACE_MAP_SYSTEM, "Locate every face in this image.", jpeg);
    return faces;
  },
  clipPlan(segments, ctx) {
    return structured(ClipPlanSchema, "clip_plan", CLIP_PLAN_SYSTEM, clipPlanInput(segments, ctx));
  },
};
