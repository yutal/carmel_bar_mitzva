import { z } from "zod";

/** Languages of the guest pages and of the text printed on a creation. Strings for each live in lib/i18n.ts. */
export const LANGS = ["he", "en"] as const;
export type Lang = (typeof LANGS)[number];

/** "blessing": the blessing alone, saved to the album with no image or song. */
export const EXPERIENCES = ["image", "song", "both", "blessing"] as const;
export type Experience = (typeof EXPERIENCES)[number];

/** Image styles a guest can pick. Art direction for each lives in prompts/styles.ts. */
export const IMAGE_STYLES = {
  movie: { icon: "🎬", label: "פוסטר קולנועי", hint: "אתם בכיכוב סרט שנולד מהסיפור שלכם" },
  animation: { icon: "✨", label: "סרט אנימציה", hint: "דמויות תלת־ממד, כמו בסרט מצויר" },
  comic: { icon: "💥", label: "גיבורי־על", hint: "שער של חוברת קומיקס צבעונית" },
  magazine: { icon: "📰", label: "שער מגזין", hint: "על השער, עם כותרות עליכם" },
  card: { icon: "⚽", label: "כרטיס שחקן", hint: "כרטיס אספנות עם ציון ותכונות" },
  toy: { icon: "📦", label: "בובה בקופסה", hint: "בובת אקשן באריזה, עם אביזרים מהסיפור" },
} as const;
export type ImageStyle = keyof typeof IMAGE_STYLES;
const IMAGE_STYLE_KEYS = Object.keys(IMAGE_STYLES) as [ImageStyle, ...ImageStyle[]];

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
  imageStyle: z.enum(IMAGE_STYLE_KEYS).default("movie"),
  musicStyle: z.enum(Object.keys(MUSIC_STYLES) as [MusicStyle, ...MusicStyle[]]).default("auto"),
  consentPhoto: z.boolean(),
  consentScreen: z.boolean(),
  /** Opt-in: the finished image and blessing may be used to advertise the station. */
  consentMarketing: z.boolean().default(false),
  /** Language of the guest page; everything printed on the creation is written in it. */
  lang: z.enum(LANGS).default("he"),
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
  genre: z.string().describe("Story genre, e.g. sports drama, superhero, fantasy adventure, space"),
  rationale: z.string().describe("One sentence in the poster language: which detail of the guest's story this concept is built on"),
  titleHebrew: z.string().describe("Short title in the poster language (the field name is historical), max 4 words"),
  taglineHebrew: z.string().describe("Short tagline in the poster language, max 8 words"),
  coverLines: z.array(z.string()).describe("Magazine style only: 3 short cover lines in the poster language, max 5 words each. Empty otherwise"),
  stats: z
    .array(z.object({ label: z.string(), value: z.number().int() }))
    .describe("Player card style only: 4 attributes in the poster language (max 2 words) scored 80-99. Empty otherwise"),
  guestPhotoPeople: z
    .array(z.string())
    .describe(
      "One short English description per person visible in the guest photo, left to right, NOT including the celebrant. Empty when there is no photo",
    ),
  celebrantInGuestPhoto: z
    .boolean()
    .describe("True only when the celebrant himself is clearly one of the people in the guest photo. False when there is no photo"),
  imagePrompt: z.string().describe("Detailed English prompt for the image model"),
});
export type ImageConcept = z.infer<typeof ImageConceptSchema>;

/** A face in the generated art, as fractions of the image width and height (0 = left/top, 1 = right/bottom). */
export const FaceBoxSchema = z.object({
  left: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
});
export type FaceBox = z.infer<typeof FaceBoxSchema>;

/** A second model's look at a finished artwork, for the style check in /admin/qa. */
export const PosterCheckSchema = z.object({
  peopleCount: z.number().int().describe("Distinct people or characters in the artwork (image 1), counting every face or figure, even small ones"),
  celebrantCopies: z.number().int().describe("How many figures in the artwork are the celebrant (the boy in image 2). Correct is exactly 1"),
  guestPeopleShown: z.number().int().describe("How many different people from the guest photo (image 3) appear in the artwork. 0 when there is no guest photo"),
  extraPeople: z.number().int().describe("People or characters in the artwork who are neither the celebrant nor anyone from the guest photo"),
  photographicFaces: z.number().int().describe("Faces that look like a real photograph pasted in, when the art style is illustrated, animated or toy. 0 for photographic styles"),
  styleMatches: z.boolean().describe("The whole artwork is in the requested art style"),
  textInImage: z.boolean().describe("Letters, words or numbers are painted into the artwork"),
  notes: z.string().describe("One short sentence in Hebrew on what is wrong; empty when everything is right"),
});
export type PosterCheck = z.infer<typeof PosterCheckSchema>;
export const FaceMapSchema = z.object({
  faces: z.array(FaceBoxSchema).describe("Every face in the image, from the eyebrows to the chin and ear to ear"),
});

/** Stage 2 for the song: a brief that Suno turns into lyrics and music (we never write the lyrics). */
export const SongConceptSchema = z.object({
  titleHebrew: z.string(),
  sunoPrompt: z.string().describe("Song description for Suno's simple mode, max 400 characters, ready to paste"),
  coverPrompt: z.string().describe("English prompt for a square album cover image, no text in the image"),
});
export type SongConcept = z.infer<typeof SongConceptSchema>;

/** One timed line of a guest's spoken video or recording, in seconds from the start of the file. */
export type TranscriptSegment = { start: number; end: number; text: string };

/** One spoken word with its time, for word-by-word captions and for cutting a phrase out of a recording. */
export type TranscriptWord = { word: string; start: number; end: number };

/** Which spoken lines go into the edited clip. Ranges are inclusive transcript segment indices. */
export const ClipPlanSchema = z.object({
  titleHebrew: z.string().describe("Short clip title in the language spoken, max 5 words"),
  quoteHebrew: z.string().describe("The single most moving sentence, copied verbatim from the transcript"),
  ranges: z
    .array(z.object({ first: z.number().int(), last: z.number().int() }))
    .describe("Segments to keep, as inclusive index ranges in original order"),
});
export type ClipPlan = z.infer<typeof ClipPlanSchema>;

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
  /** Running number of the creation at the event, shown to the guest like a ticket number. */
  number?: number;
  createdAt: string;
  input: GuestInput;
  hidden: boolean;
  /** Marked as a test by the organiser: never on the hall screen, left out of the album, counts and quota. */
  test?: boolean;
  stages: { analysis: StageState; image?: StageState; song?: StageState };
  analysis?: Analysis;
  imageConcept?: ImageConcept;
  songConcept?: SongConcept;
  /** Faces found in the generated art; the poster text is laid out around them. */
  faces?: FaceBox[];
  files: SubmissionFiles;
};

export type StageName = keyof Submission["stages"];

export type EventSettings = {
  celebrantName: string;
  /** The name as written on English pages and creations. */
  celebrantNameEn: string;
  eventTitle: string;
  eventDate: string;
  footer: string;
  /** Footer line on English creations. */
  footerEn: string;
  /** Free-text appearance notes added to every image prompt to keep the likeness. */
  celebrantLook: string;
  /** Whether guests can ask for a song. Off: posters only. */
  songsEnabled: boolean;
};

export const DEFAULT_EVENT: EventSettings = {
  celebrantName: "כרמל",
  celebrantNameEn: "Carmel",
  eventTitle: "בר המצווה של כרמל",
  eventDate: "",
  footer: "בר המצווה של כרמל",
  footerEn: "Carmel's Bar Mitzvah",
  celebrantLook: "",
  songsEnabled: false,
};
