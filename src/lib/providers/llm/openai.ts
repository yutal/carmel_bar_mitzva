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
  POSTER_CHECK_SYSTEM,
  SONG_CONCEPT_SYSTEM,
  analysisSummary,
  clipPlanInput,
  guestContext,
  imageConceptInput,
  songStyleHint,
} from "@/lib/prompts";
import sharp from "sharp";
import { AnalysisSchema, ClipPlanSchema, FaceMapSchema, ImageConceptSchema, PosterCheckSchema, SongConceptSchema } from "@/lib/types";
import { recordUsage, type UsageKind } from "@/lib/usage";

async function structured<S extends z.ZodType>(
  schema: S,
  name: UsageKind,
  system: string,
  user: string,
  image?: Buffer | Buffer[],
): Promise<z.infer<S>> {
  const images = image ? [image].flat() : [];
  const response = await openai().responses.parse({
    model: config.llmModel,
    instructions: system,
    input: images.length
      ? [
          {
            role: "user",
            content: [
              { type: "input_text", text: user },
              ...images.map((img) => ({ type: "input_image" as const, image_url: `data:image/jpeg;base64,${img.toString("base64")}`, detail: "high" as const })),
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
  imageConcept(input, event, guestPhoto) {
    return structured(ImageConceptSchema, "image_concept", IMAGE_CONCEPT_SYSTEM, imageConceptInput(input, event, Boolean(guestPhoto)), guestPhoto);
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
  async checkPoster(art, celebrant, guestPhoto, style) {
    const jpeg = (b: Buffer) => sharp(b).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
    const images = [await jpeg(art), await jpeg(celebrant), ...(guestPhoto ? [await jpeg(guestPhoto)] : [])];
    const user = [
      `Image 1: the artwork to check. Requested art style: ${style}`,
      "Image 2: a photo of the celebrant, a 13-year-old boy.",
      guestPhoto ? "Image 3: the guest photo. Everyone in it except the celebrant should appear in the artwork exactly once." : "There is no guest photo: the celebrant should be alone.",
    ].join("\n");
    return structured(PosterCheckSchema, "qa_check", POSTER_CHECK_SYSTEM, user, images);
  },
  clipPlan(segments, ctx) {
    return structured(ClipPlanSchema, "clip_plan", CLIP_PLAN_SYSTEM, clipPlanInput(segments, ctx));
  },
};
