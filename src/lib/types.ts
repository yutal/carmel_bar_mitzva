import { z } from "zod";

export const EXPERIENCES = ["image", "song", "both"] as const;
export type Experience = (typeof EXPERIENCES)[number];

export const MUSIC_STYLES = {
  auto: "תבחר אתה",
  emotional: "מרגש",
  upbeat: "קצבי ושמח",
  funny: "מצחיק",
  hiphop: "היפ הופ",
  rock: "רוק",
  mizrahi: "מזרחי",
} as const;
export type MusicStyle = keyof typeof MUSIC_STYLES;

export const GuestInputSchema = z.object({
  fullName: z.string().trim().min(2).max(60),
  relationship: z.string().trim().min(1).max(60),
  together: z.string().trim().max(300).default(""),
  memory: z.string().trim().max(600).default(""),
  talent: z.string().trim().max(300).default(""),
  blessing: z.string().trim().min(5).max(600),
  experience: z.enum(EXPERIENCES),
  musicStyle: z.enum(Object.keys(MUSIC_STYLES) as [MusicStyle, ...MusicStyle[]]).default("auto"),
  consentPhoto: z.boolean(),
  consentScreen: z.boolean(),
});
export type GuestInput = z.infer<typeof GuestInputSchema>;

/** Stage 1 output: what the blessing is actually about. */
export const AnalysisSchema = z.object({
  themes: z.array(z.string()).describe("Main themes, in English"),
  sharedActivities: z.array(z.string()).describe("Concrete things the guest and celebrant do together"),
  insideJokes: z.array(z.string()),
  emotions: z.array(z.string()),
  celebrantTraits: z.array(z.string()).describe("Interests, talents, personality of the celebrant mentioned"),
  visualMotifs: z.array(z.string()).describe("Concrete objects, places, props that could appear in a picture"),
  tone: z.enum(["emotional", "funny", "epic", "sweet", "mixed"]),
  isAppropriate: z.boolean().describe("False if the text is offensive or unsuitable for a family event"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/** Stages 2+3 for the image: creative direction and the image prompt. */
export const ImageConceptSchema = z.object({
  genre: z.string().describe("Poster genre, e.g. sports drama, superhero, fantasy adventure, space"),
  rationale: z.string().describe("One sentence in Hebrew: which detail of the blessing this concept is built on"),
  titleHebrew: z.string().describe("Short Hebrew movie title, max 4 words"),
  taglineHebrew: z.string().describe("Short Hebrew tagline, max 8 words"),
  imagePrompt: z.string().describe("Detailed English prompt for the image model"),
});
export type ImageConcept = z.infer<typeof ImageConceptSchema>;

/** Stage 2 for the song: a brief that Suno turns into lyrics and music (we never write the lyrics). */
export const SongConceptSchema = z.object({
  titleHebrew: z.string(),
  sunoPrompt: z.string().describe("Song description for Suno's simple mode, max 400 characters, ready to paste"),
  coverPrompt: z.string().describe("English prompt for a square album cover image, no text in the image"),
});
export type SongConcept = z.infer<typeof SongConceptSchema>;

export const STAGE_STATUSES = ["pending", "running", "done", "failed", "awaiting_music"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export type StageState = { status: StageStatus; error?: string; updatedAt: string };

export type SubmissionFiles = {
  photo?: string;
  imageRaw?: string;
  image?: string;
  sunoPrompt?: string;
  mp3?: string;
  cover?: string;
};

export type Submission = {
  id: string;
  publicId: string;
  createdAt: string;
  input: GuestInput;
  hidden: boolean;
  stages: { analysis: StageState; image?: StageState; song?: StageState };
  analysis?: Analysis;
  imageConcept?: ImageConcept;
  songConcept?: SongConcept;
  files: SubmissionFiles;
};

export type StageName = keyof Submission["stages"];

export type EventSettings = {
  celebrantName: string;
  eventTitle: string;
  eventDate: string;
  footer: string;
};

export const DEFAULT_EVENT: EventSettings = {
  celebrantName: "כרמל",
  eventTitle: "בר המצווה של כרמל",
  eventDate: "",
  footer: "בר המצווה של כרמל",
};
