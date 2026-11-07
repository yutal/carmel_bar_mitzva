import "server-only";
import { currentSlug } from "./scope";
import { canonical, licenseBlock, LicenseSchema, LOCKED_LICENSE, type License, type LicenseBlock } from "./license-rules";
import { sign, verify } from "./secret";
import type { ToolId } from "./tools";
import { dataPath, readJson, writeJson } from "@/lib/storage/fs";

type Stored = { license: unknown; sig: string };
export type LicenseView = License & { tampered?: boolean };

const file = () => dataPath("license.json");
const purpose = () => `license:${currentSlug()}`;

/**
 * The current event's licence. A missing file, a schema error or a bad signature all give the locked licence:
 * the safe failure is "closed". The slug is part of the signature, so a licence copied to another event fails too.
 */
export async function getLicense(): Promise<LicenseView> {
  const stored = await readJson<Stored>(file()).catch(() => undefined);
  if (!stored) return { ...LOCKED_LICENSE, tampered: true };
  const parsed = LicenseSchema.safeParse(stored.license);
  if (!parsed.success || typeof stored.sig !== "string" || !verify(purpose(), canonical(parsed.data), stored.sig)) {
    return { ...LOCKED_LICENSE, tampered: true };
  }
  return parsed.data;
}

/** Owner only; the caller checks. */
export async function saveLicense(license: License): Promise<License> {
  const lic = LicenseSchema.parse({ ...license, issuedAt: new Date().toISOString() });
  await writeJson(file(), { license: lic, sig: sign(purpose(), canonical(lic)) } satisfies Stored);
  return lic;
}

export class LicenseError extends Error {
  constructor(readonly block: LicenseBlock) {
    super(block);
  }
}

/** Counts and spend the licence limits are checked against, from the current event's files. */
export async function licenseUsage() {
  const { listSubmissions } = await import("@/lib/storage/submissions");
  const { readUsage } = await import("@/lib/usage");
  const [subs, usage] = await Promise.all([listSubmissions(), readUsage()]);
  return {
    creations: subs.filter((s) => !s.test && s.input.experience !== "blessing").length,
    spentUsd: usage.reduce((t, e) => t + e.costUsd, 0),
  };
}

/**
 * Throws a LicenseError when the tool is closed for the current event. `creating` also checks the creation quota;
 * `staff` is for the organiser's own tools, which ignore the guests' time window.
 */
export async function assertTool(tool: ToolId, opts: { creating?: boolean; staff?: boolean } = {}): Promise<void> {
  const block = licenseBlock(await getLicense(), tool, await licenseUsage(), Date.now(), opts);
  if (block) throw new LicenseError(block);
}
