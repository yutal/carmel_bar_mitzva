import type { ImageStyle } from "@/lib/types";

/**
 * Art direction per image style. Each brief keeps the areas where our code later
 * draws Hebrew text calm, so the layouts in compose/poster.ts stay readable.
 */
export const STYLE_BRIEFS: Record<ImageStyle, string> = {
  movie: `Format: a cinematic movie poster.
Look: photorealistic, dramatic film lighting, rich colour grade, shallow depth of field.
Calm areas: keep the top 15% and the bottom 35% of the frame visually calm (sky, haze, dark floor).
Faces: every face sits between 18% and 62% of the frame height.`,

  animation: `Format: a poster for a 3D animated family feature film.
Look: stylised 3D characters with expressive eyes, soft global illumination, saturated friendly colours.
Translate each person's real features into the style: same hair colour and cut, skin tone, glasses, smile and age.
Calm areas: keep the top 15% and the bottom 35% of the frame visually calm.
Faces: every face sits between 18% and 62% of the frame height.`,

  comic: `Format: the cover of a superhero comic book; the celebrant is the hero, with a costume and power drawn from the story.
Look: bold ink outlines, halftone shading, vivid flat colours, dynamic heroic pose, action lines.
Keep each person's face recognisable in the illustrated style.
Calm areas: keep the top 15% (where the comic title goes) and the bottom 35% visually calm, e.g. a plain sky or solid colour.
Faces: every face sits between 18% and 62% of the frame height.`,

  magazine: `Format: the cover photo of a glossy celebrity magazine starring the celebrant.
Look: studio fashion photography, waist-up portrait, confident pose, clean seamless backdrop in one colour that suits the story,
props from the story in hand. The guest, if shown, stands slightly behind him.
Calm areas: the top 20% is plain backdrop (the masthead goes there; hair may overlap it, faces may not); the bottom 25% is calm.
Faces and cover lines (cover lines are printed later on the backdrop beside the people, never on a face):
- one or two people: put every face in the left 60% of the frame, so the right third between 25% and 65% height is clean backdrop;
- three or more: group them tightly, faces in a band between 22% and 50% height, and leave clean backdrop down one side below
  their shoulders;
- no face higher than 20% or lower than 62% of the frame height.
Also write coverLines: 3 short Hebrew cover lines about the celebrant, drawn from the guest's story (max 5 words each).`,

  card: `Format: the artwork of a premium collectible sports player card; the celebrant is the star player.
Look: dynamic hero portrait from the waist up, stadium or arena lights, light rays, glossy energetic colours,
the sport or activity from the story (if there is none, pick the celebrant's talent).
Composition: subject centred, head in the upper third; no border, frame, badges or numbers (our code draws the card).
Faces: every face sits between 12% and 50% of the frame height; the top-right corner stays clear (a badge goes there).
Calm areas: the bottom 30% of the frame is soft, dark and plain.
Also write stats: 4 attributes in Hebrew (max 2 words each) taken from the story, e.g. "זריקות לסל", "צחוק", "חברות",
each scored 80-99.`,

  toy: `Format: the celebrant as a collectible action figure inside a retail blister package, photographed on a shelf.
Look: realistic product photography of a plastic toy with a clear plastic window; the figure looks like the celebrant
in toy form (same hair, skin tone, face); 3-4 small accessories from the story sit in moulded slots next to him.
Calm areas: the top 15% of the package is a plain solid-colour header card with no text; the bottom 35% of the package
is a plain card backing with no text.
Faces: every face (the figure's and any other figure's) sits between 18% and 62% of the frame height.`,
};
