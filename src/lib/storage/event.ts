import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DIRS, dataPath, ensureDirs, readJson, writeFileAtomic, writeJson } from "./fs";
import { DEFAULT_EVENT, type EventSettings } from "@/lib/types";

const eventFile = () => dataPath("event.json");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export async function getEvent(): Promise<EventSettings> {
  return { ...DEFAULT_EVENT, ...(await readJson<Partial<EventSettings>>(eventFile())) };
}

export async function saveEvent(settings: EventSettings): Promise<void> {
  await writeJson(eventFile(), settings);
}

export async function listCelebrantPhotos(): Promise<string[]> {
  await ensureDirs();
  const names = await fs.readdir(dataPath(DIRS.celebrant));
  return names.filter((n) => IMAGE_EXT.has(path.extname(n).toLowerCase())).sort();
}

export function celebrantPhotoPath(name: string): string {
  return dataPath(DIRS.celebrant, path.basename(name));
}

export async function addCelebrantPhoto(jpeg: Buffer): Promise<string> {
  const name = `carmel_${Date.now()}.jpg`;
  await writeFileAtomic(celebrantPhotoPath(name), jpeg);
  return name;
}

export async function removeCelebrantPhoto(name: string): Promise<void> {
  await fs.rm(celebrantPhotoPath(name), { force: true });
}
