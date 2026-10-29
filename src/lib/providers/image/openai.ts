import "server-only";
import { toFile } from "openai";
import { config } from "@/lib/config";
import { openai } from "@/lib/providers/openai-client";
import type { ImageProvider } from "@/lib/providers/types";
import { recordUsage } from "@/lib/usage";

const SIZES = { portrait: "1024x1536", square: "1024x1024" } as const;

export const openAiImage: ImageProvider = {
  async generate({ prompt, references, size }) {
    const images = await Promise.all(
      references.map((r) => toFile(r.data, r.name, { type: "image/jpeg" })),
    );
    const result = images.length
      ? await openai().images.edit({
          model: config.imageModel,
          image: images,
          prompt,
          size: SIZES[size],
          quality: config.imageQuality,
          output_format: "png",
        })
      : await openai().images.generate({
          model: config.imageModel,
          prompt,
          size: SIZES[size],
          quality: config.imageQuality,
          output_format: "png",
        });

    await recordUsage("image", config.imageModel, {
      inputTokens: result.usage?.input_tokens,
      imageInputTokens: result.usage?.input_tokens_details?.image_tokens,
      outputTokens: result.usage?.output_tokens,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image model returned no image");
    return Buffer.from(b64, "base64");
  },
};
