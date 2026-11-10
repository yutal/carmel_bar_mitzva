import "server-only";
import fs from "node:fs/promises";
import { platformPath } from "@/lib/storage/fs";
import type { Actor } from "./roles";

export type AuditEntry = { at: string; actor: string; action: string; event?: string; detail?: string; ip?: string };

const file = () => platformPath("audit.jsonl");

export const actorLabel = (a: Actor | null | undefined) => (!a ? "anonymous" : a.kind === "owner" ? `owner:${a.name}` : `operator:${a.username}`);

/** Who did what and when: logins, licences, accounts, exports. Append-only; a failed write never blocks the action. */
export async function audit(actor: Actor | null | string, action: string, extra: Omit<AuditEntry, "at" | "actor" | "action"> = {}): Promise<void> {
  const entry: AuditEntry = { at: new Date().toISOString(), actor: typeof actor === "string" ? actor : actorLabel(actor), action, ...extra };
  await fs.mkdir(platformPath(), { recursive: true }).catch(() => undefined);
  await fs.appendFile(file(), JSON.stringify(entry) + "\n").catch((err) => console.error("[audit]", err));
}

export async function readAudit(limit = 300): Promise<AuditEntry[]> {
  const raw = await fs.readFile(file(), "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as AuditEntry];
      } catch {
        return [];
      }
    })
    .reverse();
}

/** The client address as the host's proxy reports it. Only for the log and the login throttle. */
export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}
