import "server-only";
import { config } from "@/lib/config";
import { dataPath, readJson, writeJson } from "@/lib/storage/fs";
import { checkClaims, cookieWindow, DEFAULT_GATE, GateSchema, keyWindow, type EntryClaims, type EntryKind, type Gate, type Verdict } from "./gate-rules";
import { getLicense } from "./license";
import { currentSlug } from "./scope";
import { readCookie } from "./session";
import { sign, verify } from "./secret";

/** Signing purposes differ, so a printed key can never be used as a cookie and a cookie can never be used as a key. */
const KEY = "entry-key";
const COOKIE = "entry-cookie";

export const cookieName = (kind: EntryKind, slug: string) => (kind === "screen" ? `bm_scr_${slug}` : `bm_in_${slug}`);

const file = () => dataPath("gate.json");

export async function getGate(): Promise<Gate> {
  const stored = await readJson<unknown>(file()).catch(() => undefined);
  if (stored === undefined) return DEFAULT_GATE;
  const parsed = GateSchema.safeParse(stored);
  // A damaged file closes the gate rather than opening it.
  return parsed.success ? parsed.data : { ...DEFAULT_GATE, closed: true };
}

export async function saveGate(gate: Gate): Promise<Gate> {
  const clean = GateSchema.parse(gate);
  await writeJson(file(), clean);
  return clean;
}

function encode(purpose: string, claims: EntryClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `e1.${body}.${sign(`${purpose}:${currentSlug()}`, body)}`;
}

function decode(purpose: string, token: string | undefined): EntryClaims | null {
  if (!token) return null;
  const [v, body, sig] = token.split(".");
  if (v !== "e1" || !body || !sig || !verify(`${purpose}:${currentSlug()}`, body, sig)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EntryClaims;
    const ok = typeof c.s === "string" && (c.k === "guest" || c.k === "screen") && [c.g, c.nbf, c.exp].every((n) => Number.isFinite(n));
    return ok ? c : null;
  } catch {
    return null;
  }
}

/** A key for a QR link: valid from the licence start until `hours` from now, and never past the licence end. */
export async function mintKey(kind: EntryKind, hours: number, now = Date.now()): Promise<{ token: string; nbf: number; exp: number }> {
  const [gate, license] = await Promise.all([getGate(), getLicense()]);
  const { nbf, exp } = keyWindow(license, now, hours);
  return { token: encode(KEY, { s: currentSlug(), k: kind, g: gate.gen, nbf, exp }), nbf, exp };
}

export function keyUrl(origin: string, slug: string, token: string, kind: EntryKind): string {
  return `${origin}/e/${slug}/in?k=${token}${kind === "screen" ? "&to=screen" : ""}`;
}

/** The address as the guest's browser sees it, behind the host's proxy. */
export function originOf(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** Trades a key from a scanned QR for a cookie. */
export async function redeemKey(token: string | null, now = Date.now()): Promise<{ verdict: Verdict; kind?: EntryKind; cookie?: string; maxAge?: number }> {
  const claims = decode(KEY, token ?? undefined);
  const gate = await getGate();
  const slug = currentSlug();
  const verdict = checkClaims(claims, { slug, kinds: ["guest", "screen"] }, gate, now);
  if (verdict !== "ok" || !claims) return { verdict };
  const window = cookieWindow(claims, await getLicense(), now);
  if (window.exp <= now) return { verdict: "expired" };
  const cookie = encode(COOKIE, { ...claims, ...window });
  return { verdict, kind: claims.k, cookie, maxAge: Math.floor((window.exp - now) / 1000) };
}

/** What the request's cookies prove for this event. Guest pages accept either kind; the screen only its own. */
export async function entryVerdict(request: Request, kinds: EntryKind[], now = Date.now()): Promise<Verdict> {
  const slug = currentSlug();
  const gate = await getGate();
  if (!gate.required) return "ok";
  const header = request.headers.get("cookie");
  let best: Verdict = "missing";
  for (const kind of kinds) {
    const raw = readCookie(header, cookieName(kind, slug));
    if (!raw) continue;
    const verdict = checkClaims(decode(COOKIE, raw), { slug, kinds }, gate, now);
    if (verdict === "ok") return "ok";
    best = verdict;
  }
  return best;
}

export function entryCookieHeader(name: string, value: string, maxAgeSeconds: number): string {
  return [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`, ...(config.secureCookies ? ["Secure"] : [])].join("; ");
}
