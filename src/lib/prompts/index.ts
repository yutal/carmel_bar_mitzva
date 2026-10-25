import type { Analysis, EventSettings, GuestInput } from "@/lib/types";
import { MUSIC_STYLES } from "@/lib/types";

/** The guest's own words, labelled, as the single source of truth for every stage. */
export function guestContext(input: GuestInput, event: EventSettings): string {
  return [
    `Celebrant: ${event.celebrantName}, a 13-year-old boy celebrating his Bar Mitzvah.`,
    `Guest name: ${input.fullName}`,
    `Relationship to ${event.celebrantName}: ${input.relationship}`,
    `What they love doing together: ${input.together || "(not answered)"}`,
    `A shared memory or funny story: ${input.memory || "(not answered)"}`,
    `What ${event.celebrantName} is best at: ${input.talent || "(not answered)"}`,
    `The blessing (verbatim, Hebrew): ${input.blessing}`,
  ].join("\n");
}

export const ANALYSIS_SYSTEM = `You analyse a personal Bar Mitzvah blessing written in Hebrew by a guest.
Extract only what the guest actually wrote or clearly implied. Never invent hobbies, events or facts.
Prefer concrete, specific details (a sport, a place, a game, a running joke) over generic sentiment.
Write list items in short English phrases. Empty lists are fine when nothing fits.`;

export const IMAGE_CONCEPT_SYSTEM = `You are the creative director of a personalised movie-poster booth at a Bar Mitzvah.
Turn one guest's blessing into ONE cinematic poster concept that tells THEIR story with the celebrant.

Rules:
- The concept must be built on the most specific detail the guest gave (shared activity, memory, inside joke, talent).
  A generic "celebration" poster is a failure. Explain in "rationale" (Hebrew, one sentence) which detail you used.
- Pick the genre that fits the detail: sports championship, superhero, heist, space mission, fantasy quest,
  action comedy, documentary, music tour, cooking show, etc. Keep it family friendly and warm.
- Hebrew title: punchy, max 4 words, may play on the celebrant's name or the shared activity.
- Hebrew tagline: max 8 words.
- imagePrompt (English, 120-220 words) for an image model that receives reference photos:
  * Say who is who: "The boy from the celebrant reference photos" is the hero; keep his face, hair and likeness exactly.
  * If a guest photo is provided, "the person from the guest photo" appears next to him, keeping their likeness, age and gender.
    If not, show the guest only from behind or as a silhouette, or leave them out if that suits the story better.
  * Describe scene, action, costumes, props from the blessing, lighting, camera angle, colour grade, poster composition.
  * Vertical 2:3 movie poster. Keep the top 15% and the bottom 35% of the frame visually calm (sky, haze, dark floor)
    because the title and blessing are added there later.
  * Absolutely no text, letters, numbers, logos or watermarks in the image.
  * Photorealistic cinematic style unless the concept clearly calls for animation.`;

export const SONG_CONCEPT_SYSTEM = `You are a Hebrew songwriter writing a personal song from one guest to a Bar Mitzvah boy.

Rules:
- Natural, modern, singable Hebrew. Short lines (4-8 words). Rhymes where possible, never forced.
- The song must be about THIS guest and THIS boy: weave in the concrete activities, memories, jokes and wishes
  from the blessing. Mention the celebrant's name in the chorus. A generic birthday song is a failure.
- Structure with tags: [Verse 1], [Chorus], [Verse 2], [Chorus], [Bridge], [Chorus]. About 2.5 minutes.
- The song is sung from the guest's point of view ("I", "we").
- styleDescription: English, under 200 characters, for an AI music generator: genre, tempo, instruments,
  vocal type, mood, and "Hebrew vocals".
- coverPrompt: English prompt for a square album cover that visualises the song's story; no text in the image.`;

export function songStyleHint(input: GuestInput): string {
  if (input.musicStyle === "auto") return "Choose the musical style that best fits the blessing's tone.";
  return `The guest asked for this style: ${MUSIC_STYLES[input.musicStyle]} (${input.musicStyle}).`;
}

export function analysisSummary(a: Analysis): string {
  return JSON.stringify(a, null, 2);
}
