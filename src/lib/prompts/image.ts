import type { ImageStyle } from "@/lib/types";
import { STYLE_RENDER } from "./styles";

/**
 * Everything the image model is told, built in one place so it can be tested for every style and photo case.
 * The model sees several photos of the celebrant and maybe one guest photo; most wrong posters came from it
 * reading each celebrant photo as another person, inventing a guest when there was no photo, or drawing the
 * celebrant twice when he was also in the guest's selfie. The cast below closes each of those doors.
 */

export type Reference = { role: "celebrant" | "guest" };

/** Who is in the picture, from the image concept. */
export type Cast = {
  /** People in the guest photo other than the celebrant, left to right; empty when there is no photo. */
  guestPeople: string[];
  /** The celebrant is also in the guest photo (a selfie with him). He is still drawn only once. */
  celebrantInGuestPhoto: boolean;
  hasGuestPhoto: boolean;
};

/** Total number of people the image must show. */
export function headCount(cast: Cast): number {
  if (!cast.hasGuestPhoto) return 1;
  return 1 + Math.max(cast.guestPeople.length, cast.celebrantInGuestPhoto ? 0 : 1);
}

/**
 * Whether the guest photo goes to the image model. A photo that shows only the celebrant adds nobody, and sent
 * next to his own photos it is the likeliest way to get him drawn twice, so it is left out.
 */
export function sendsGuestPhoto(cast: Cast): boolean {
  return cast.hasGuestPhoto && !(cast.celebrantInGuestPhoto && cast.guestPeople.length === 0);
}

const LIKENESS = [
  "Identity is the top priority: every person shown must be clearly recognisable as the person in their reference images.",
  "Keep their exact face shape, eyes, eyebrows, nose, mouth, smile, hair colour, hairstyle, skin tone and age.",
  "In an illustrated, animated or toy style, translate exactly these features into that style.",
  "Use the references only for identity; pose, outfit, lighting and setting come from the scene below.",
  "Show faces large enough to recognise, never hidden by helmets, masks or heavy shadow.",
].join(" ");

const NO_TEXT = "Absolutely no text, letters, numbers, logos or watermarks anywhere in the image.";

/** What each reference image is, with all the celebrant photos named as one and the same boy. */
export function referenceLegend(refs: Reference[], cast: Cast, style: ImageStyle): string {
  const celebrant = refs.flatMap((r, i) => (r.role === "celebrant" ? [i + 1] : []));
  const guest = refs.findIndex((r) => r.role === "guest") + 1;
  const lines: string[] = [];
  if (celebrant.length === 1) lines.push(`Reference image ${celebrant[0]}: the celebrant, a 13-year-old boy. He appears exactly once in the image.`);
  if (celebrant.length > 1) {
    lines.push(
      `Reference images ${celebrant.join(", ")}: all of them show the SAME boy, the celebrant, photographed several times. ` +
        "They are one person, not several: draw him exactly once.",
    );
  }
  if (guest) {
    const people = cast.guestPeople;
    const who = people.length === 0
      ? cast.celebrantInGuestPhoto ? "only the celebrant" : "the guest"
      : people.length === 1
        ? `one person: ${people[0]}`
        : `${people.length} people, left to right: ${people.join("; ")}`;
    lines.push(
      `Reference image ${guest}: the guest photo, showing ${who}.` +
        (people.length || !cast.celebrantInGuestPhoto ? " Each of them appears exactly once, with their own face." : ""),
    );
    if (cast.celebrantInGuestPhoto) {
      lines.push("The celebrant is also in the guest photo. He is the same boy as in his own reference images: draw him once, not twice.");
    }
    if (style === "animation") lines.push("Use the guest photo for who they are only: draw them as 3D animated characters, like the celebrant.");
  }
  return lines.join("\n");
}

/** One sentence: how many people and who. */
export function castHead(cast: Cast): string {
  const n = headCount(cast);
  const who = !cast.hasGuestPhoto || n === 1
    ? "the celebrant, alone. No guest, friend or family member appears, not even from behind"
    : n === 2
      ? "the celebrant and the one person from the guest photo"
      : `the celebrant and the ${n - 1} people from the guest photo`;
  return `CAST: exactly ${n} ${n === 1 ? "person" : "people"} in the image: ${who}.`;
}

/** The exact cast, said the same way for every style, so no style can add, drop or repeat a person. */
export function castLine(style: ImageStyle, cast: Cast): string {
  const lines = [
    castHead(cast),
    "Count them. Nobody else appears anywhere in the frame: no extra characters, crowd, teammates, background figures, silhouettes, reflections, " +
      "posters or photos of people, and no second copy of anyone.",
    "If the scene below mentions anyone else (friends, family, a team, a crowd, an audience, everyone cheering), " +
      "they stay out of the picture: show the moment through the cast's expressions, props and setting only.",
  ];
  if (style === "animation") {
    lines.push(
      "Every person, the celebrant and each person from the guest photo alike, is the same kind of 3D animated character; " +
        "nobody keeps a photographic face or real skin. Keep each likeness through their features, redrawn in the animated style.",
    );
  }
  return lines.join(" ");
}

/** The full prompt for one poster. `retry` explains what went wrong the first time. */
export function buildImagePrompt(opts: {
  style: ImageStyle;
  scene: string;
  references: Reference[];
  cast: Cast;
  celebrantLook?: string;
  retry?: string;
}): string {
  const render = STYLE_RENDER[opts.style];
  return [
    `ART STYLE, the most important instruction: ${render}`,
    referenceLegend(opts.references, opts.cast, opts.style),
    opts.references.length ? LIKENESS : "",
    opts.celebrantLook ? `The celebrant's appearance: ${opts.celebrantLook}` : "",
    castLine(opts.style, opts.cast),
    opts.scene,
    opts.retry ?? "",
    castHead(opts.cast),
    NO_TEXT,
    `Remember: the whole image is ${render}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Prompt for a square song cover: the celebrant only, no style rules. */
export function buildCoverPrompt(scene: string, references: Reference[], celebrantLook?: string): string {
  const cast: Cast = { guestPeople: [], celebrantInGuestPhoto: false, hasGuestPhoto: false };
  return [referenceLegend(references, cast, "movie"), references.length ? LIKENESS : "", celebrantLook ? `The celebrant's appearance: ${celebrantLook}` : "", scene, NO_TEXT]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * After painting, the faces found are compared with the cast. A mismatch means a person was added, repeated
 * or dropped; the caller paints once more. Small differences in face finding are not worth a second image,
 * so only a clear miscount counts.
 */
export function castMismatch(facesFound: number, cast: Cast): string | null {
  const n = headCount(cast);
  if (facesFound > n) return `The previous attempt showed ${facesFound} people instead of ${n}: it added or repeated someone. Draw exactly ${n}.`;
  if (facesFound < n && cast.hasGuestPhoto) return `The previous attempt showed only ${facesFound} of the ${n} people. Draw all ${n}, every face visible.`;
  return null;
}
