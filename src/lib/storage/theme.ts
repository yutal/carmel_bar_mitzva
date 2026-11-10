import "server-only";
import fs from "node:fs/promises";
import sharp from "sharp";
import { DEFAULT_THEME, ThemeSchema, type Theme } from "@/lib/platform/theme-rules";
import { dataPath, readJson, writeFileAtomic, writeJson } from "./fs";

const themeFile = () => dataPath("theme.json");
const logoFile = () => dataPath("theme", "logo.png");

/** The current event's theme; a missing or damaged file gives the default look, never an error page. */
export async function getTheme(): Promise<Theme> {
  const parsed = ThemeSchema.safeParse(await readJson<unknown>(themeFile()).catch(() => undefined));
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

export async function saveTheme(theme: Theme): Promise<void> {
  await writeJson(themeFile(), theme);
}

/** Logo upload: re-encoded as a PNG of at most 600 px, so whatever was uploaded (even a disguised file) is only ever served as an image. */
export async function saveLogo(input: Buffer): Promise<void> {
  const png = await sharp(input, { failOn: "error" }).rotate().resize(600, 600, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  await writeFileAtomic(logoFile(), png);
}

export async function removeLogo(): Promise<void> {
  await fs.rm(logoFile(), { force: true });
}

export const logoPath = logoFile;
