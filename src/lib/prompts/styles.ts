import type { ImageStyle } from "@/lib/types";

/**
 * Art direction per image style. Each brief keeps the areas where our code later
 * draws Hebrew text calm, so the layouts in compose/poster.ts stay readable.
 */
export const STYLE_BRIEFS: Record<ImageStyle, string> = {
  movie: `Format: a cinematic movie poster.
Look: photorealistic, dramatic film lighting, rich colour grade, shallow depth of field.
Calm areas: keep the top 15% and the bottom 35% of the frame visually calm (sky, haze, dark floor).`,

  animation: `Format: a poster for a 3D animated family feature film.
Look: stylised 3D characters with expressive eyes, soft global illumination, saturated friendly colours.
Translate each person's real features into the style: same hair colour and cut, skin tone, glasses, smile and age.
Calm areas: keep the top 15% and the bottom 35% of the frame visually calm.`,

  comic: `Format: the cover of a superhero comic book; the celebrant is the hero, with a costume and power drawn from the story.
Look: bold ink outlines, halftone shading, vivid flat colours, dynamic heroic pose, action lines.
Keep each person's face recognisable in the illustrated style.
Calm areas: keep the top 15% (where the comic title goes) and the bottom 35% visually calm, e.g. a plain sky or solid colour.`,

  magazine: `Format: the cover photo of a glossy celebrity magazine starring the celebrant.
Look: studio fashion photography, waist-up portrait, confident pose, clean seamless backdrop in one colour that suits the story,
props from the story in hand. The guest, if shown, stands slightly behind him.
Calm areas: the top 20% is plain backdrop (the masthead goes there; the top of the head may overlap it slightly);
the right third of the frame between 25% and 65% height is uncluttered backdrop (cover lines go there), so place the subject
slightly left of centre; the bottom 25% is calm.
Also write coverLines: 3 short Hebrew cover lines about the celebrant, drawn from the guest's story (max 5 words each).`,

  card: `Format: the artwork of a premium collectible sports player card; the celebrant is the star player.
Look: dynamic hero portrait from the waist up, stadium or arena lights, light rays, glossy energetic colours,
the sport or activity from the story (if there is none, pick the celebrant's talent).
Composition: subject centred, head in the upper third; no border, frame, badges or numbers (our code draws the card).
Calm areas: the bottom 30% of the frame is soft, dark and plain.
Also write stats: 4 attributes in Hebrew (max 2 words each) taken from the story, e.g. "זריקות לסל", "צחוק", "חברות",
each scored 80-99.`,

  toy: `Format: the celebrant as a collectible action figure inside a retail blister package, photographed on a shelf.
Look: realistic product photography of a plastic toy with a clear plastic window; the figure looks like the celebrant
in toy form (same hair, skin tone, face); 3-4 small accessories from the story sit in moulded slots next to him.
Calm areas: the top 15% of the package is a plain solid-colour header card with no text; the bottom 35% of the package
is a plain card backing with no text.`,
};
