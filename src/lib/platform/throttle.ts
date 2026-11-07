import "server-only";

/**
 * Slows down password guessing: after 5 failed logins for the same name or from the same address within 15 minutes,
 * that name or address is locked for 15 minutes. In memory, so it resets on restart, which is fine for one server.
 */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;
const fails = new Map<string, number[]>();

const recent = (key: string, now: number) => (fails.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

export function loginLocked(keys: string[], now = Date.now()): boolean {
  return keys.some((k) => recent(k, now).length >= MAX_FAILS);
}

export function recordLoginFailure(keys: string[], now = Date.now()): void {
  for (const k of keys) fails.set(k, [...recent(k, now), now]);
  if (fails.size > 10_000) for (const [k] of fails) if (!recent(k, now).length) fails.delete(k);
}

export function clearLoginFailures(keys: string[]): void {
  for (const k of keys) fails.delete(k);
}
