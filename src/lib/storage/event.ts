import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { DIRS, dataPath, ensureDirs, readJson, writeFileAtomic, writeJson } from "./fs";
import { DEFAULT_EVENT, type EventSettings } from "@/lib/types";

const eventFile = () => dataPath("event.json");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export async function getEvent(): Promise<EventSettings> {
  const event = { ...DEFAULT_EVENT, ...(await readJson<Partial<EventSettings>>(eventFile())) };
  // The look description shipped with the app applies until someone writes one in /admin.
  if (!event.celebrantLook.trim()) event.celebrantLook = await seedLook();
  return event;
}

let shippedLook: string | undefined;
async function seedLook(): Promise<string> {
  shippedLook ??= await fs.readFile(path.join(config.celebrantSeedDir, "look.txt"), "utf8").then((t) => t.trim(), () => "");
  return shippedLook;
}

/**
 * Copies the celebrant photos shipped in assets/celebrant into DATA_DIR, so they survive
 * a host without a persistent disk. Photos already there are left alone.
 */
export async function seedCelebrantPhotos(): Promise<number> {
  await ensureDirs();
  const shipped = await fs.readdir(config.celebrantSeedDir).catch(() => [] as string[]);
  let copied = 0;
  for (const name of shipped.filter((n) => IMAGE_EXT.has(path.extname(n).toLowerCase()))) {
    const target = celebrantPhotoPath(`seed_${name}`);
    const exists = await fs.access(target).then(() => true, () => false);
    if (exists) continue;
    await fs.copyFile(path.join(config.celebrantSeedDir, name), target);
    copied++;
  }
  return copied;
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
