import "server-only";
import { toFile } from "openai";
import { config } from "@/lib/config";
import { openai } from "@/lib/providers/openai-client";
import type { ImageProvider } from "@/lib/providers/types";
import { recordUsage } from "@/lib/usage";

const SIZES = { portrait: "1024x1536", square: "1024x1024" } as const;

const LIKENESS = [
  "Identity is the top priority: every person shown must be clearly recognisable as the person in their reference images.",
  "Keep their exact face shape, eyes, eyebrows, nose, mouth, smile, hair colour, hairstyle, skin tone and age.",
  "In an illustrated, animated or toy style, translate exactly these features into that style.",
  "Use the references only for identity; pose, outfit, lighting and setting come from the scene below.",
  "Every person in the guest photo appears in the image, each one keeping their own face; do not merge, drop or swap faces.",
  "Show faces large enough to recognise, never hidden by helmets, masks or heavy shadow.",
].join(" ");

export const openAiImage: ImageProvider = {
  async generate({ prompt, references, size, celebrantLook, artStyle }) {
    const images = await Promise.all(
      references.map((r) => toFile(r.data, r.name, { type: "image/jpeg" })),
    );
    const legend = references
      .map((r, i) => `Reference image ${i + 1}: ${r.label ?? (r.role === "celebrant" ? "the celebrant (Bar Mitzvah boy)" : "the guest photo")}.`)
      .join("\n");
    const fullPrompt = [
      artStyle ? `ART STYLE, the most important instruction: ${artStyle}` : "",
      legend,
      references.length ? LIKENESS : "",
      celebrantLook ? `The celebrant's appearance: ${celebrantLook}` : "",
      prompt,
      artStyle ? `Remember: the whole image is ${artStyle}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = images.length
      ? await openai().images.edit({
          model: config.imageModel,
          image: images,
          prompt: fullPrompt,
          size: SIZES[size],
          quality: config.imageQuality,
          output_format: "png",
        })
      : await openai().images.generate({
          model: config.imageModel,
          prompt: fullPrompt,
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
