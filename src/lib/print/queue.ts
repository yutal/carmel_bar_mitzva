import "server-only";
import fs from "node:fs/promises";
import { config } from "@/lib/config";
import { currentSlug } from "@/lib/platform/scope";
import { dataPath, readJson, writeFileAtomic, writeJson } from "@/lib/storage/fs";
import { filePath, getSubmission } from "@/lib/storage/submissions";
import { PRINT_PROFILES, type PrintProfileId } from "./profiles";
import { copyToHotFolder, renderPrintFile } from "./render";

export const PRINT_STATUSES = ["queued", "printed", "skipped"] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];

export type PrintItem = {
  id: string;
  /** Running number on every print of the event; shown in the queue and in the file name. */
  serial: number;
  submissionId: string;
  guestName: string;
  profile: PrintProfileId;
  copies: number;
  status: PrintStatus;
  createdAt: string;
  printedAt?: string;
};
type State = { nextSerial: number; items: PrintItem[] };

const stateFile = () => dataPath("print", "queue.json");
const outFile = (item: PrintItem) => dataPath("print", `${String(item.serial).padStart(4, "0")}_${item.profile}.jpg`);

// Serialises changes per event, so two operators pressing "add" at once get different serial numbers.
const chains = new Map<string, Promise<unknown>>();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const key = currentSlug();
  const next = (chains.get(key) ?? Promise.resolve()).then(fn, fn);
  const settled = next.catch(() => undefined);
  chains.set(key, settled);
  void settled.then(() => chains.get(key) === settled && chains.delete(key));
  return next;
}

async function load(): Promise<State> {
  return (await readJson<State>(stateFile())) ?? { nextSerial: 1, items: [] };
}

export async function listPrintItems(): Promise<PrintItem[]> {
  return (await load()).items;
}

export const getPrintItem = async (id: string) => (await load()).items.find((i) => i.id === id);

/** Adds a finished poster to the queue. The same poster in the same size is not added twice while it is still queued. */
export function addPrintItem(submissionId: string, profile: PrintProfileId, copies: number): Promise<PrintItem> {
  return exclusive(async () => {
    const sub = await getSubmission(submissionId);
    if (!sub?.files.image) throw new Error("There is no finished poster to print");
    const state = await load();
    const dup = state.items.find((i) => i.submissionId === submissionId && i.profile === profile && i.status === "queued");
    if (dup) return dup;
    const item: PrintItem = {
      id: `p${state.nextSerial}`,
      serial: state.nextSerial,
      submissionId,
      guestName: sub.input.fullName,
      profile,
      copies: Math.min(20, Math.max(1, Math.round(copies))),
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    state.nextSerial++;
    state.items.push(item);
    await writeJson(stateFile(), state);
    return item;
  });
}

export function updatePrintItem(id: string, patch: { status?: PrintStatus; copies?: number }): Promise<PrintItem | undefined> {
  return exclusive(async () => {
    const state = await load();
    const item = state.items.find((i) => i.id === id);
    if (!item) return undefined;
    if (patch.status) {
      item.status = patch.status;
      if (patch.status === "printed") item.printedAt = new Date().toISOString();
    }
    if (patch.copies) item.copies = Math.min(20, Math.max(1, Math.round(patch.copies)));
    await writeJson(stateFile(), state);
    return item;
  });
}

export function removePrintItem(id: string): Promise<boolean> {
  return exclusive(async () => {
    const state = await load();
    const item = state.items.find((i) => i.id === id);
    if (!item) return false;
    state.items = state.items.filter((i) => i.id !== id);
    await writeJson(stateFile(), state);
    await fs.rm(outFile(item), { force: true });
    return true;
  });
}

/**
 * The print file for an item, rendered once and kept next to the queue. A poster regenerated since is picked up:
 * the file is rebuilt when the poster is newer than it.
 */
export async function printFileFor(item: PrintItem): Promise<Buffer> {
  const out = outFile(item);
  const sub = await getSubmission(item.submissionId);
  if (!sub?.files.image) throw new Error("The poster is missing");
  const posterPath = filePath(sub.files.image);
  const [posterStat, outStat] = await Promise.all([fs.stat(posterPath), fs.stat(out).catch(() => undefined)]);
  if (outStat && outStat.mtimeMs >= posterStat.mtimeMs) return fs.readFile(out);
  const jpeg = await renderPrintFile(await fs.readFile(posterPath), PRINT_PROFILES[item.profile]);
  await writeFileAtomic(out, jpeg);
  await copyToHotFolder(config.printHotFolder, `${currentSlug()}_${String(item.serial).padStart(4, "0")}_${item.profile}.jpg`, jpeg);
  return jpeg;
}
