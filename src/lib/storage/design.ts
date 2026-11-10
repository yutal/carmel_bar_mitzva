import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import sharp from "sharp";
import { currentSlug } from "@/lib/platform/scope";
import {
  applyBriefInput,
  BriefSchema,
  briefToMarkdown,
  emptyBrief,
  MAX_ASSETS,
  type Asset,
  type AssetRole,
  type Brief,
  type BriefInput,
} from "@/lib/platform/design-brief";
import { getTheme } from "./theme";
import { DIRS, dataPath, readJson, writeFileAtomic, writeJson } from "./fs";

/**
 * The design brief on disk, inside the current event's folder:
 *   design/brief.json   the structured brief (what the app reads and writes)
 *   design/brief.md     the same in words, rewritten on every save
 *   design/assets/      the uploaded pictures, named <id>.png or <id>.jpg
 * Nothing here is in the database or the app's memory; the folder is the whole state, so it can be copied, read or
 * synced by anything else.
 */
const briefFile = () => dataPath(DIRS.design, "brief.json");
const mdFile = () => dataPath(DIRS.design, "brief.md");
export const assetFile = (a: Pick<Asset, "id" | "ext">) => dataPath(DIRS.design, "assets", `${a.id}.${a.ext}`);
export const assetRelative = (a: Pick<Asset, "id" | "ext">) => `assets/${a.id}.${a.ext}`;

// Saves and uploads read, change and write the same file; one at a time per event.
const queues = new Map<string, Promise<unknown>>();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const slug = currentSlug();
  const run = (queues.get(slug) ?? Promise.resolve()).then(fn);
  queues.set(slug, run.catch(() => undefined));
  return run;
}

/** A missing or damaged file gives an empty brief, never an error page. */
export async function getBrief(): Promise<Brief> {
  const parsed = BriefSchema.safeParse(await readJson<unknown>(briefFile()).catch(() => undefined));
  return parsed.success ? parsed.data : emptyBrief();
}

async function write(brief: Brief): Promise<void> {
  await writeJson(briefFile(), brief);
  const md = briefToMarkdown(brief, { theme: await getTheme(), themeFile: "../theme.json", assetFile: assetRelative });
  await writeFileAtomic(mdFile(), md);
}

export function updateBrief(input: BriefInput, by: string): Promise<{ brief: Brief } | { error: string }> {
  return serial(async () => {
    const result = applyBriefInput(await getBrief(), input, by, new Date());
    if ("brief" in result) await write(result.brief);
    return result;
  });
}

/** The picture is re-encoded already (readUpload); here it gets an id, a file and a place in the brief. */
export function addAsset(image: Buffer, role: AssetRole, name: string, by: string): Promise<{ asset: Asset; brief: Brief } | { error: string }> {
  return serial(async () => {
    const brief = await getBrief();
    if (brief.assets.length >= MAX_ASSETS) return { error: `אפשר לשמור עד ${MAX_ASSETS} תמונות` };
    const format = (await sharp(image).metadata()).format;
    const asset: Asset = {
      id: `a${randomBytes(4).toString("hex")}`,
      role,
      name,
      ext: format === "png" ? "png" : "jpg",
      addedAt: new Date().toISOString(),
    };
    await writeFileAtomic(assetFile(asset), image);
    const next = { ...brief, assets: [...brief.assets, asset], updatedAt: asset.addedAt, updatedBy: by };
    await write(next);
    return { asset, brief: next };
  });
}

export function removeAsset(id: string, by: string): Promise<Brief | undefined> {
  return serial(async () => {
    const brief = await getBrief();
    const asset = brief.assets.find((a) => a.id === id);
    if (!asset) return undefined;
    await fs.rm(assetFile(asset), { force: true });
    const next: Brief = {
      ...brief,
      assets: brief.assets.filter((a) => a.id !== id),
      deliverables: brief.deliverables.map((d) => ({ ...d, references: d.references.filter((r) => r !== id) })),
      updatedAt: new Date().toISOString(),
      updatedBy: by,
    };
    await write(next);
    return next;
  });
}
