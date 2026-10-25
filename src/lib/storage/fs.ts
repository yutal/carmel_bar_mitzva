import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";

export const DIRS = {
  celebrant: "celebrant",
  uploads: "uploads",
  blessings: "blessings",
  images: "images",
  songs: "songs",
  exports: "exports",
} as const;
export type DirName = keyof typeof DIRS;

export function dataPath(...parts: string[]): string {
  const full = path.resolve(config.dataDir, ...parts);
  if (full !== config.dataDir && !full.startsWith(config.dataDir + path.sep)) {
    throw new Error("Path escapes data dir");
  }
  return full;
}

export async function ensureDirs(): Promise<void> {
  await Promise.all(
    Object.values(DIRS).map((d) => fs.mkdir(dataPath(d), { recursive: true })),
  );
}

/** Write via temp file + rename so readers never see a half-written file. */
export async function writeFileAtomic(file: string, data: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, data);
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

export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(value, null, 2));
}
