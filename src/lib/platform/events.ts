import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { eventRoot, eventsRoot, platformPath, readJson, writeJson } from "@/lib/storage/fs";
import { DEFAULT_EVENT, type EventSettings } from "@/lib/types";
import { saveLicense } from "./license";
import { unlimitedLicense, type License } from "./license-rules";
import { withEvent } from "./scope";
import { isSlug, splitPublicId } from "./slug";

/** Platform-wide settings. */
export type PlatformSettings = {
  /** Served at the site root, so a QR code printed before events existed keeps working. */
  defaultEvent?: string;
  /** Guest links made before events existed have no event in them; they belong to this one. */
  legacyEvent?: string;
};

const platformFile = () => platformPath("platform.json");

export async function getPlatform(): Promise<PlatformSettings> {
  return (await readJson<PlatformSettings>(platformFile())) ?? {};
}

export async function savePlatform(p: PlatformSettings): Promise<void> {
  await writeJson(platformFile(), p);
}

export async function eventExists(slug: string): Promise<boolean> {
  if (!isSlug(slug)) return false;
  return fs.access(path.join(eventRoot(slug), "event.json")).then(
    () => true,
    () => false,
  );
}

export async function listEventSlugs(): Promise<string[]> {
  const names = await fs.readdir(eventsRoot()).catch(() => [] as string[]);
  const found = await Promise.all(names.map(async (n) => ((await eventExists(n)) ? n : null)));
  return found.filter((n): n is string => Boolean(n)).sort();
}

/** Runs fn once inside every event, one after another. For startup and housekeeping jobs. */
export async function forEachEvent(fn: (slug: string) => Promise<void>): Promise<void> {
  for (const slug of await listEventSlugs()) {
    await withEvent(slug, () => fn(slug)).catch((err) => console.error(`[events] ${slug}:`, err));
  }
}

export class EventExistsError extends Error {}

/** Creates an event directory with its settings and licence. Owner only; the caller checks. */
export async function createEvent(slug: string, settings: EventSettings, license: License): Promise<void> {
  if (!isSlug(slug)) throw new Error("Invalid slug");
  await fs.mkdir(eventsRoot(), { recursive: true });
  try {
    // mkdir without recursive fails when the directory exists, so two owners racing for one slug cannot both win.
    await fs.mkdir(eventRoot(slug));
  } catch {
    throw new EventExistsError(slug);
  }
  await withEvent(slug, async () => {
    await saveLicense(license);
    await writeJson(path.join(eventRoot(slug), "event.json"), settings);
    // New events start with the entry gate on: guests get in only through a QR key.
    await writeJson(path.join(eventRoot(slug), "gate.json"), { required: true, gen: 0, closed: false });
  });
}

/** Carmel's settings before events existed: they were the code's defaults, so an old event.json may rely on them. */
const LEGACY_DEFAULTS: EventSettings = {
  ...DEFAULT_EVENT,
  celebrantName: "כרמל",
  celebrantNameEn: "Carmel",
  eventTitle: "בר המצווה של כרמל",
  footer: "בר המצווה של כרמל",
  footerEn: "Carmel's Bar Mitzvah",
};

/** Everything that used to sit directly in DATA_DIR and now belongs to the first event's directory. */
const LEGACY_ENTRIES = ["event.json", "usage.jsonl", "celebrant", "uploads", "blessings", "images", "songs", "exports", "lab", "qa"];

/**
 * Upgrades a single-event installation: moves its files into events/<DEFAULT_EVENT_SLUG>/, gives that event a full
 * licence and makes it the default. A fresh installation gets the same event, empty. Runs once; later starts see
 * the event and skip.
 */
export async function migrateLegacyLayout(): Promise<void> {
  const slug = config.defaultEventSlug;
  if (!isSlug(slug)) throw new Error(`DEFAULT_EVENT_SLUG "${slug}" is not a valid slug`);
  const platform = await getPlatform();
  if ((await listEventSlugs()).length) {
    // An OpenAI balance recorded before the upgrade belongs to the platform, not to one event.
    await moveIfPresent(path.join(config.dataDir, "openai-balance.json"), platformPath("openai-balance.json"));
    return;
  }

  const root = eventRoot(slug);
  await fs.mkdir(root, { recursive: true });
  let moved = 0;
  for (const name of LEGACY_ENTRIES) {
    if (await moveIfPresent(path.join(/*turbopackIgnore: true*/ config.dataDir, name), path.join(/*turbopackIgnore: true*/ root, name))) moved++;
  }
  await moveIfPresent(path.join(config.dataDir, "openai-balance.json"), platformPath("openai-balance.json"));

  const eventFile = path.join(root, "event.json");
  const old = await readJson<Partial<EventSettings>>(eventFile);
  await writeJson(eventFile, { ...LEGACY_DEFAULTS, ...old });
  await withEvent(slug, () => saveLicense(unlimitedLicense()));
  // An installation that already had guests keeps its printed QR codes working until the organiser turns the gate on.
  if (moved) await writeJson(path.join(root, "gate.json"), { required: false, gen: 0, closed: false });
  await savePlatform({ ...platform, defaultEvent: platform.defaultEvent ?? slug, legacyEvent: platform.legacyEvent ?? slug });
  console.log(`[events] created event "${slug}"${moved ? ` from ${moved} existing item(s)` : ""}`);
}

async function moveIfPresent(from: string, to: string): Promise<boolean> {
  try {
    await fs.access(from);
  } catch {
    return false;
  }
  if (await fs.access(to).then(() => true, () => false)) {
    console.warn(`[events] ${to} already exists; left ${from} where it is`);
    return false;
  }
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
    await fs.cp(from, to, { recursive: true });
    await fs.rm(from, { recursive: true, force: true });
  }
  return true;
}

/** The event a guest's public link belongs to: the slug inside the id, or the legacy event for ids made before events. */
export async function eventOfPublicId(publicId: string): Promise<string | undefined> {
  const parts = splitPublicId(publicId);
  if (!parts) return undefined;
  const slug = parts.slug ?? (await getPlatform()).legacyEvent;
  return slug && (await eventExists(slug)) ? slug : undefined;
}
