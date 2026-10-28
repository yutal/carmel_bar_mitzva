import "server-only";
import { toFile } from "openai";
import { config } from "@/lib/config";
import { openai } from "@/lib/providers/openai-client";
import type { ImageProvider } from "@/lib/providers/types";

const SIZES = { portrait: "1024x1536", square: "1024x1024" } as const;

const LIKENESS = [
  "Identity is the top priority: every person shown must be clearly recognisable as the person in their reference images.",
  "Keep their exact face shape, eyes, eyebrows, nose, mouth, smile, hair colour, hairstyle, skin tone and age.",
  "In an illustrated, animated or toy style, translate exactly these features into that style.",
  "Use the references only for identity; pose, outfit, lighting and setting come from the scene below.",
  "Show faces large enough to recognise, never hidden by helmets, masks or heavy shadow.",
].join(" ");

export const openAiImage: ImageProvider = {
  async generate({ prompt, references, size, celebrantLook }) {
    const images = await Promise.all(
      references.map((r) => toFile(r.data, r.name, { type: "image/jpeg" })),
    );
    const legend = references
      .map((r, i) => `Reference image ${i + 1}: ${r.role === "celebrant" ? "the celebrant (Bar Mitzvah boy)" : "the guest"}.`)
      .join("\n");
    const fullPrompt = [legend, references.length ? LIKENESS : "", celebrantLook ? `The celebrant's appearance: ${celebrantLook}` : "", prompt]
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

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image model returned no image");
    return Buffer.from(b64, "base64");
  },
};
