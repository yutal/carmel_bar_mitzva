import { LANG_INFO, type Lang } from "@/lib/i18n";
import type { Analysis, EventSettings, GuestInput } from "@/lib/types";
import { MUSIC_STYLES, type ImageStyle } from "@/lib/types";
import { STYLE_BRIEFS } from "./styles";

/** The celebrant's name as written in a given language. */
export const celebrantNameIn = (event: EventSettings, lang: Lang) => (lang === "en" && event.celebrantNameEn) || event.celebrantName;

/** The guest's own words, labelled, as the single source of truth for every stage. */
export function guestContext(input: GuestInput, event: EventSettings): string {
  const lang = LANG_INFO[input.lang ?? "he"].english;
  return [
    `Celebrant: ${event.celebrantName} (in English: ${event.celebrantNameEn || event.celebrantName}), a 13-year-old boy celebrating his Bar Mitzvah.`,
    `Poster language: ${lang}. Every word printed on the creation (title, tagline, cover lines, stats, rationale, song title) is in ${lang},`,
    `whatever language the guest wrote in; names are written the way ${lang} writes them.`,
    `Guest name: ${input.fullName}`,
    `Relationship to ${event.celebrantName}: ${input.relationship}`,
    `What they love doing together: ${input.together || "(not answered)"}`,
    `A shared memory or funny story: ${input.memory || "(not answered)"}`,
    `What ${event.celebrantName} is best at: ${input.talent || "(not answered)"}`,
    `The blessing (verbatim, in the guest's own language): ${input.blessing}`,
  ].join("\n");
}

export const ANALYSIS_SYSTEM = `You analyse a personal Bar Mitzvah blessing written by a guest, in Hebrew, English or any other language.
Extract only what the guest actually wrote or clearly implied. Never invent hobbies, events or facts.
Prefer concrete, specific details (a sport, a place, a game, a running joke) over generic sentiment.
Write list items in short English phrases. Empty lists are fine when nothing fits.`;

export const IMAGE_CONCEPT_SYSTEM = `You are the creative director of a personalised art booth at a Bar Mitzvah.
Turn one guest's story and blessing into ONE image concept, in the art style the guest picked, that tells THEIR story with the celebrant.

Rules:
- The concept must be built on the most specific detail the guest gave (shared activity, memory, inside joke, talent).
  A generic "celebration" image is a failure. Explain in "rationale" (one sentence, in the poster language) which detail you used.
- Pick the story genre that fits the detail: sports championship, superhero, heist, space mission, fantasy quest,
  action comedy, documentary, music tour, cooking show, etc. Keep it family friendly and warm.
- Title (in the poster language): punchy, max 4 words, may play on the celebrant's name or the shared activity.
- Tagline (in the poster language): max 8 words.
- Fill coverLines and stats only when the style brief asks for them; otherwise return empty lists.
- If the guest photo is attached, look at it closely. It may show one person or a group (a selfie with family or friends).
  List EVERY person visible in it in guestPhotoPeople, left to right, each with apparent age, gender, hair (colour, length,
  style), facial hair, glasses, skin tone and one clothing detail. If one of them is clearly the celebrant, say so and do not
  count him twice. With no photo, return an empty list.
- imagePrompt (English, 120-220 words) for an image model that receives reference photos:
  * Say who is who: "The boy from the celebrant reference photos" is the hero; keep his face, hair and likeness.
  * If a guest photo is provided, EVERY person from it appears in the scene next to him, each keeping their own face, age and gender.
    Refer to them by their place in the photo ("the woman on the left of the guest photo") and repeat the key features you listed,
    so the image model can match each face. Give each of them a role in the story.
    If not, show the guest only from behind or as a silhouette, or leave them out if that suits the story better.
  * Composition with several people: every face is large, front-facing or three-quarter, unobstructed and well lit;
    nobody is cropped, turned away, hidden behind another person or in deep shadow. The celebrant stays the hero in front.
  * Text is printed on the image later in fixed places (see the style brief). Plan where every face goes for the
    number of people in the scene, so no face falls where text will be printed, and repeat the brief's face placement
    in the prompt in plain words (e.g. "both faces in the left half, between 20% and 55% of the height").
  * Describe scene, action, costumes, props from the story, lighting, camera angle and colour grade,
    in the art style and composition the style brief gives. The brief's calm areas are mandatory: text is added there later.
  * Vertical 2:3 frame.
  * Absolutely no text, letters, numbers, logos or watermarks in the image.`;

export const SONG_CONCEPT_SYSTEM = `You prepare a brief for Suno, an AI music generator that writes the lyrics and the music itself.
The song is a personal gift from one guest to a Bar Mitzvah boy.

Rules:
- sunoPrompt: one paragraph of at most 400 characters, pasted as-is into Suno's "Song description" box.
  Write it in English. Keep names exactly as written in the poster language (Hebrew letters for Hebrew).
  It must say: a song in the poster language, for the Bar Mitzvah of <celebrant>, sung from <guest>'s point of view (their relationship),
  and the story. Build the story from the guest's answers about the celebrant, in this order of importance:
  what they love doing together, the shared memory or funny story, and what the celebrant is best at.
  Use the blessing only for the closing wish. Finish with the musical style (genre, tempo, mood, vocal type).
  Concrete details beat adjectives. A generic birthday song is a failure.
- titleHebrew: a short song title in the poster language that fits the story.
- coverPrompt: English prompt for a square album cover that visualises the song's story; no text in the image.`;

export function songStyleHint(input: GuestInput): string {
  if (input.musicStyle === "auto") return "Choose the musical style that best fits the blessing's tone.";
  return `The guest asked for this style: ${MUSIC_STYLES[input.musicStyle]} (${input.musicStyle}).`;
}

export function analysisSummary(a: Analysis): string {
  return JSON.stringify(a, null, 2);
}

export function imageStyleBrief(style: ImageStyle): string {
  return `Art style picked by the guest: ${style}.\n${STYLE_BRIEFS[style]}`;
}

export const CLIP_PLAN_SYSTEM = `You are the video editor of a Bar Mitzvah blessing booth.
A guest recorded a short spoken blessing (video or voice) for the celebrant. You get the transcript as numbered, timed segments.
Choose what stays in a short edited clip that will be played at the party and kept by the family.

Rules:
- Keep the heart of the message: the personal story, the warmest words and the closing wish. Drop false starts, repeats,
  "wait, is it recording?", filler and anything said to the person filming.
- Return 1 to 3 ranges of whole segments, in their original order. Never reorder: the clip must sound natural.
- The kept segments must add up to at most the given number of seconds. If the whole recording fits and is clean, keep all of it.
- Prefer ending on a wish or a "mazal tov".
- The transcript may be in Hebrew, English or another language. Write titleHebrew in the language that was spoken.
- titleHebrew: a warm title of up to 5 words, may use the celebrant's name.
- quoteHebrew: the single most moving sentence, copied word for word from the transcript.`;

export function clipPlanInput(segments: { start: number; end: number; text: string }[], ctx: { guestName: string; celebrantName: string; maxSeconds: number }): string {
  return [
    `Celebrant: ${ctx.celebrantName}. Speaker: ${ctx.guestName || "a guest"}.`,
    `Maximum clip length: ${ctx.maxSeconds} seconds.`,
    "",
    ...segments.map((s, i) => `[${i}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}s (${(s.end - s.start).toFixed(1)}s): ${s.text.trim()}`),
  ].join("\n");
}

export const FACE_MAP_SYSTEM = `You locate faces in an illustration or photo so that text can be placed without covering anyone.
Return a box for EVERY human or character face, including small ones in the background, cartoon, comic and toy faces.
Each box spans from the eyebrows to the chin and from ear to ear, as fractions of the image width and height
(left/right from 0 at the left edge to 1 at the right edge; top/bottom from 0 at the top to 1 at the bottom).
Be generous rather than tight. Hair, bodies and props are not faces. If there are no faces, return an empty list.`;
