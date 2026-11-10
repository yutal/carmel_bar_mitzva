import "server-only";
import { config } from "@/lib/config";
import { getAccount } from "./accounts";
import type { Actor } from "./roles";
import { sign, verify } from "./secret";

export const SESSION_COOKIE = "bm_session";

type Payload = { sub: string; sv: number; exp: number; pw?: string };

/** Ties owner sessions to the current owner password: changing ADMIN_PASSWORD logs the owner out everywhere. */
const ownerPasswordTag = () => sign("owner-pw", config.adminPassword ?? "").slice(0, 16);

export function createSessionToken(sub: string, sessionVersion: number): string {
  const payload: Payload = { sub, sv: sessionVersion, exp: Date.now() + config.sessionHours * 3600_000 };
  if (sub === "owner") payload.pw = ownerPasswordTag();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `v1.${body}.${sign("session", body)}`;
}

/**
 * The person behind a session cookie, or null. Checks the signature and expiry, then reads the account again,
 * so a disabled account, a changed password or a removed event takes effect on the very next request.
 */
export async function actorFromToken(token: string | undefined): Promise<Actor | null> {
  if (!token) return null;
  const [v, body, sig] = token.split(".");
  if (v !== "v1" || !body || !sig || !verify("session", body, sig)) return null;
  let p: Payload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }
  if (typeof p.exp !== "number" || p.exp < Date.now()) return null;
  if (p.sub === "owner") {
    if (!config.adminPassword || p.pw !== ownerPasswordTag()) return null;
    return { kind: "owner", name: config.ownerUsername };
  }
  const account = await getAccount(p.sub);
  if (!account || account.disabled || account.sessionVersion !== p.sv) return null;
  return { kind: "operator", id: account.id, username: account.username, name: account.name, events: account.events };
}

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function actorFromRequest(request: Request): Promise<Actor | null> {
  return actorFromToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(config.secureCookies ? ["Secure"] : []),
  ].join("; ");
}
