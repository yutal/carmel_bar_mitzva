import { z } from "zod";
import type { License } from "./license-rules";

/**
 * The entry gate: how a guest's phone (or the hall screen) proves it was at the event.
 *
 * The QR code does not hold a plain address. It holds a link with a signed, expiring key. Scanning it trades the key
 * for a cookie that is valid for a few hours; every guest API call needs that cookie. A bare address, an old
 * screenshot or a QR from last week gets nothing but a "scan the code" message. Pure rules live here so they are
 * testable; signing and storage are in gate.ts.
 */

export const GateSchema = z.object({
  /** When false the event behaves as before: the plain /e/<slug> address works (kept for QR codes printed earlier). */
  required: z.boolean().default(true),
  /** Raising this number kills every QR key and entry cookie issued so far. */
  gen: z.number().int().min(0).default(0),
  /** Kill switch: while true nobody enters, whatever keys they hold. */
  closed: z.boolean().default(false),
});
export type Gate = z.infer<typeof GateSchema>;

/** No gate file means the gate is on: the safe failure is "closed to strangers". */
export const DEFAULT_GATE: Gate = { required: true, gen: 0, closed: false };

export type EntryKind = "guest" | "screen";
export type EntryClaims = { s: string; k: EntryKind; g: number; nbf: number; exp: number };

/** The QR shown on the hall screen is renewed this often, and each key lives this long. */
export const ROLLING_MINUTES = 30;
export const ROLLING_REFRESH_MINUTES = 10;
/** A scanned key becomes a cookie for this long at most (and never past the end of the event's window). */
export const COOKIE_HOURS = 6;
/** Longest life of a key an organiser mints for printing. */
export const MAX_KEY_HOURS = 24 * 7;
/** A screen key lasts the evening. */
export const SCREEN_KEY_HOURS = 24;

export type Verdict = "ok" | "missing" | "invalid" | "wrong_event" | "wrong_kind" | "revoked" | "not_yet" | "expired" | "closed";

export function checkClaims(claims: EntryClaims | null, want: { slug: string; kinds: EntryKind[] }, gate: Gate, now: number): Verdict {
  if (!claims) return "invalid";
  if (claims.s !== want.slug) return "wrong_event";
  if (!want.kinds.includes(claims.k)) return "wrong_kind";
  if (gate.closed) return "closed";
  if (claims.g !== gate.gen) return "revoked";
  if (now < claims.nbf) return "not_yet";
  if (now >= claims.exp) return "expired";
  return "ok";
}

/**
 * When a key minted now is valid: from the licence start (a key printed early waits for the doors to open) until
 * `hours` from now, but never past the licence end.
 */
export function keyWindow(license: Pick<License, "startsAt" | "endsAt">, now: number, hours: number): { nbf: number; exp: number } {
  const start = license.startsAt ? Date.parse(license.startsAt) : now;
  const nbf = Math.max(now, Number.isFinite(start) ? start : now);
  let exp = now + Math.min(hours, MAX_KEY_HOURS) * 3600_000;
  if (license.endsAt) exp = Math.min(exp, Date.parse(license.endsAt));
  return { nbf, exp: Math.max(exp, nbf) };
}

/** The cookie a scan earns: short, and never past the key's own end or the event's end. */
export function cookieWindow(claims: EntryClaims, license: Pick<License, "endsAt">, now: number): { nbf: number; exp: number } {
  let exp = Math.min(claims.exp, now + COOKIE_HOURS * 3600_000);
  if (license.endsAt) exp = Math.min(exp, Date.parse(license.endsAt));
  return { nbf: now, exp };
}

export const ENTRY_MESSAGES: Record<Verdict, { he: string; en: string }> = {
  ok: { he: "", en: "" },
  missing: { he: "כדי להשתתף, סרקו את קוד ה-QR שבאולם.", en: "To take part, scan the QR code at the event." },
  invalid: { he: "הקישור אינו תקין. סרקו שוב את קוד ה-QR שבאולם.", en: "This link is not valid. Please scan the QR code at the event again." },
  wrong_event: { he: "הקישור שייך לאירוע אחר. סרקו את הקוד של האירוע הזה.", en: "This link belongs to another event. Scan this event's code." },
  wrong_kind: { he: "הקישור אינו מתאים לדף הזה.", en: "This link does not fit this page." },
  revoked: { he: "הקוד הוחלף. סרקו את הקוד העדכני שבאולם.", en: "This code was replaced. Scan the current code at the event." },
  not_yet: { he: "הכניסה עוד לא נפתחה. נסו שוב כשהאירוע יתחיל.", en: "Entry has not opened yet. Try again when the event starts." },
  expired: { he: "תוקף הקוד פג. סרקו שוב את קוד ה-QR שבאולם.", en: "This code has expired. Scan the QR code at the event again." },
  closed: { he: "הכניסה סגורה כרגע.", en: "Entry is closed right now." },
};
