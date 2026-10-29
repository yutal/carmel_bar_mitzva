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
  MAX_CREATIONS_PER_GUEST: z.coerce.number().int().min(0).default(3),
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
  /** Creations one guest (by name) may make; 0 means no limit. */
  maxCreationsPerGuest: env.MAX_CREATIONS_PER_GUEST,
  fontsDir: path.resolve(process.cwd(), "assets/fonts"),
  /** Celebrant photos and look.txt shipped with the app, copied into DATA_DIR on startup. */
  celebrantSeedDir: path.resolve(process.cwd(), "assets/celebrant"),
} as const;

export function requireOpenAiKey(): string {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not set");
  return config.openaiApiKey;
}
