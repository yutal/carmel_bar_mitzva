import type { ImageStyle } from "@/lib/types";

/**
 * How each style must be rendered, in one line. The image model gets it first and last, because the reference
 * photos otherwise pull every style towards a photograph.
 */
export const STYLE_RENDER: Record<ImageStyle, string> = {
  movie: "a photorealistic cinematic movie-poster photograph with dramatic film lighting and a rich colour grade.",
  animation:
    "a still from a 3D animated family feature film (the look of a modern Pixar or DreamWorks film): stylised 3D characters with " +
    "slightly larger heads and expressive eyes, smooth stylised skin, soft global illumination, saturated colours. " +
    "It is NOT a photograph and NOT photorealistic; every person, including the ones from the photos, is a 3D animated character " +
    "who is still instantly recognisable as that real person: same face shape, hair colour and cut, skin tone, glasses, age and gender. " +
    "The cast is only the people from the reference photos: no invented characters, sidekicks, extra kids, parents or background people.",
  comic:
    "a hand-drawn superhero comic-book cover illustration: bold black ink outlines, flat vivid colours, halftone dots, action lines. " +
    "It is NOT a photograph; every person is drawn in comic style.",
  magazine:
    "a glossy celebrity magazine cover photograph shot in a photo studio: one seamless, plain, single-colour paper backdrop, " +
    "softbox fashion lighting, waist-up portrait looking at the camera. NOT an outdoor scene, NOT a movie scene, no landscape behind them.",
  card:
    "the art of a premium sports trading card: a dynamic hero shot against an abstract glowing background of light rays, sparks " +
    "and the sport's colours, glossy energetic colours. NOT a real stadium, field or court, so there is nobody behind them. " +
    "The only people are the ones from the reference photos, posed together as one team: no teammates, opponents, referees, " +
    "coaches, fans, crowd or figures in the distance.",
  toy:
    "a product photograph of a plastic action figure sealed in a retail blister box: the people are moulded plastic toy figures " +
    "with painted faces, NOT real people.",
};

/**
 * Art direction per image style. Each brief keeps the areas where our code later
 * draws text calm, so the layouts in compose/poster.ts stay readable.
 */
export const STYLE_BRIEFS: Record<ImageStyle, string> = {
  movie: `Format: a cinematic movie poster.
Look: photorealistic, dramatic film lighting, rich colour grade, shallow depth of field.
Calm areas: keep the top 15% and the bottom 35% of the frame visually calm (sky, haze, dark floor).
Faces: every face sits between 18% and 62% of the frame height.`,

  animation: `Format: a poster for a 3D animated family feature film.
Look: stylised 3D characters with expressive eyes, soft global illumination, saturated friendly colours.
Every person, including each person from the guest photo, becomes a 3D animated character in the same style as the celebrant;
nobody keeps a photographic face. Translate each person's real features into the style: same hair colour and cut, skin tone,
glasses, smile and age. Say this in imagePrompt for each person from the guest photo.
Cast: only the celebrant and every person from the guest photo. With no guest photo, the celebrant alone.
Never add characters the guest did not send: no friends, siblings, sidekicks, mascots, crowds or people in the background.
Name the cast in imagePrompt and say "no other people".
Calm areas: keep the top 15% and the bottom 35% of the frame visually calm.
Faces: every face sits between 18% and 62% of the frame height.`,

  comic: `Format: the cover of a superhero comic book; the celebrant is the hero, with a costume and power drawn from the story.
Look: bold ink outlines, halftone shading, vivid flat colours, dynamic heroic pose, action lines.
Keep each person's face recognisable in the illustrated style.
Calm areas: keep the top 15% (where the comic title goes) and the bottom 35% visually calm, e.g. a plain sky or solid colour.
Faces: every face sits between 18% and 62% of the frame height.`,

  magazine: `Format: the cover photo of a glossy celebrity magazine starring the celebrant.
Look: studio fashion photography, waist-up portrait, confident pose, clean seamless backdrop in one colour that suits the story,
props from the story in hand. The people from the guest photo, if any, stand close beside or slightly behind him;
with no guest photo he is alone on the cover. Only one celebrant: never a second boy, twin, reflection or cut-out of him.
Calm areas: the top 20% is plain backdrop (the magazine name goes there in huge letters; hair may overlap it, faces may not);
the bottom 30% is calm (the cover headline goes there).
Faces and cover lines (cover lines are printed later on the backdrop beside the people, never on a face):
- one or two people: put every face in the left 60% of the frame, so the right third between 25% and 65% height is clean backdrop;
- three or more: group them tightly, faces in a band between 22% and 50% height, and leave clean backdrop down one side below
  their shoulders;
- no face higher than 20% or lower than 62% of the frame height.
Also write coverLines: 3 short cover lines in the poster language about the celebrant, drawn from the guest's story (max 5 words each).`,

  card: `Format: the artwork of a premium collectible sports player card; the celebrant is the star player.
Look: dynamic hero portrait from the waist up against an abstract glowing background (light rays, sparks, the sport's colours),
not a real stadium, field or court; glossy energetic colours; the sport or activity from the story shown through outfit and props
(if there is none, pick the celebrant's talent).
Cast: the celebrant and every person from the guest photo, side by side as one team, all from the waist up, all faces visible.
With no guest photo, the celebrant alone: the guest does not appear at all, not even from behind. Never add teammates, opponents, referees, coaches, fans or a crowd.
Name the cast in imagePrompt and say "no other people".
Composition: subject centred, head in the upper third; no border, frame, badges or numbers (our code draws the card).
Faces: every face sits between 12% and 50% of the frame height; the top-right corner stays clear (a badge goes there).
Calm areas: the bottom 30% of the frame is soft, dark and plain.
Also write stats: 4 attributes in the poster language (max 2 words each) taken from the story,
e.g. "זריקות לסל", "צחוק", "חברות" in Hebrew or "Three-pointers", "Laughter", "Friendship" in English,
each scored 80-99.`,

  toy: `Format: the celebrant as a collectible action figure inside a retail blister package, photographed on a shelf.
Look: realistic product photography of a plastic toy with a clear plastic window; the figure looks like the celebrant
in toy form (same hair, skin tone, face); 3-4 small accessories from the story sit in moulded slots next to him.
Calm areas: the top 15% of the package is a plain solid-colour header card with no text; the bottom 35% of the package
is a plain card backing with no text.
Faces: every face (the figure's and any other figure's) sits between 18% and 62% of the frame height.`,
};
