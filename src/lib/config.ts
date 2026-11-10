import "server-only";
import path from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  DATA_DIR: z.string().default("./data"),
  LLM_MODEL: z.string().default("gpt-5.5"),
  IMAGE_MODEL: z.string().default("gpt-image-2"),
  IMAGE_QUALITY: z.enum(["low", "medium", "high"]).default("medium"),
  GENERATION_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  GUEST_PHOTO_RETENTION_DAYS: z.coerce.number().min(0).default(7),
  RESULT_LINK_HOURS: z.coerce.number().min(0).default(7),
  MAX_CREATIONS_PER_GUEST: z.coerce.number().int().min(0).default(3),
  TRANSCRIBE_MODEL: z.string().default("whisper-1"),
  CLIP_MAX_SECONDS: z.coerce.number().min(5).max(120).default(30),
  /** Signs login sessions and event licences. Without it a random key is created once in DATA_DIR/platform. */
  AUTH_SECRET: z.string().min(32).optional(),
  OWNER_USERNAME: z.string().trim().min(1).default("admin"),
  /** The event created on first start and served at the site root. */
  DEFAULT_EVENT_SLUG: z.string().default("carmel"),
  /** Optional folder the print queue copies finished files into, for a printer that watches a hot folder. */
  PRINT_HOT_FOLDER: z.string().optional(),
  SESSION_HOURS: z.coerce.number().min(1).max(24 * 30).default(12),
});

const env = EnvSchema.parse(process.env);

export const config = {
  openaiApiKey: env.OPENAI_API_KEY,
  adminPassword: env.ADMIN_PASSWORD,
  dataDir: path.resolve(env.DATA_DIR),
  llmModel: env.LLM_MODEL,
  imageModel: env.IMAGE_MODEL,
  imageQuality: env.IMAGE_QUALITY,
  concurrency: env.GENERATION_CONCURRENCY,
  /** Days to keep guests' original photos; 0 keeps them forever. */
  guestPhotoRetentionDays: env.GUEST_PHOTO_RETENTION_DAYS,
  /**
   * Hours a guest's personal link keeps working after the creation was made; 0 keeps it forever.
   * Creations on the hall screen keep serving their image, so the slideshow is not affected.
   */
  resultLinkHours: env.RESULT_LINK_HOURS,
  /** Creations one guest (by name) may make; 0 means no limit. */
  maxCreationsPerGuest: env.MAX_CREATIONS_PER_GUEST,
  /** Must return segment timestamps (verbose_json); gpt-4o-transcribe does not. */
  transcribeModel: env.TRANSCRIBE_MODEL,
  /** Longest part of a guest's video or recording kept in the edited clip. */
  clipMaxSeconds: env.CLIP_MAX_SECONDS,
  authSecret: env.AUTH_SECRET,
  /** The platform owner logs in with this name and ADMIN_PASSWORD. */
  ownerUsername: env.OWNER_USERNAME,
  defaultEventSlug: env.DEFAULT_EVENT_SLUG,
  sessionHours: env.SESSION_HOURS,
  printHotFolder: env.PRINT_HOT_FOLDER,
  secureCookies: process.env.NODE_ENV === "production",
  fontsDir: path.resolve(process.cwd(), "assets/fonts"),
  /** Celebrant photos and look.txt shipped with the app, copied into DATA_DIR on startup. */
  celebrantSeedDir: path.resolve(process.cwd(), "assets/celebrant"),
} as const;

export function requireOpenAiKey(): string {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not set");
  return config.openaiApiKey;
}
