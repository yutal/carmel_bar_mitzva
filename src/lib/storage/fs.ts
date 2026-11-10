import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { currentSlug } from "@/lib/platform/scope";

/** Folders inside every event's directory. */
export const DIRS = {
  celebrant: "celebrant",
  uploads: "uploads",
  blessings: "blessings",
  images: "images",
  songs: "songs",
  exports: "exports",
  lab: "lab",
  print: "print",
} as const;
export type DirName = keyof typeof DIRS;

/**
 * Layout of DATA_DIR:
 *   platform/            accounts, audit log, secret key, platform settings, OpenAI balance
 *   events/<slug>/       one directory per event: event.json, license.json, theme.json and the DIRS above
 */
export const eventsRoot = () => path.join(config.dataDir, "events");
export const eventRoot = (slug: string) => path.join(eventsRoot(), slug);

function inside(root: string, parts: string[]): string {
  const full = path.resolve(root, ...parts);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Path escapes data dir");
  return full;
}

/** A path inside the current event's directory. Throws outside an event scope and on any path that escapes it. */
export function dataPath(...parts: string[]): string {
  return inside(eventRoot(currentSlug()), parts);
}

/** A path inside DATA_DIR/platform: data that belongs to no single event. */
export function platformPath(...parts: string[]): string {
  return inside(path.join(config.dataDir, "platform"), parts);
}

export async function ensureDirs(): Promise<void> {
  await Promise.all(Object.values(DIRS).map((d) => fs.mkdir(dataPath(d), { recursive: true })));
}

/** Write via temp file + rename so readers never see a half-written file. */
export async function writeFileAtomic(file: string, data: string | Buffer, mode?: number): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, data, mode ? { mode } : undefined);
  await fs.rename(tmp, file);
}

export async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export async function writeJson(file: string, value: unknown, mode?: number): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(value, null, 2), mode);
}
