import assert from "node:assert/strict";
import { test } from "node:test";
import { checkClaims, cookieWindow, COOKIE_HOURS, DEFAULT_GATE, keyWindow, MAX_KEY_HOURS, type EntryClaims } from "./gate-rules";

const NOW = Date.parse("2026-06-01T18:00:00Z");
const HOUR = 3600_000;
const claims = (over: Partial<EntryClaims> = {}): EntryClaims => ({ s: "a", k: "guest", g: 0, nbf: NOW - HOUR, exp: NOW + HOUR, ...over });
const want = { slug: "a", kinds: ["guest" as const] };

test("a fresh key for this event passes", () => {
  assert.equal(checkClaims(claims(), want, DEFAULT_GATE, NOW), "ok");
});

test("every way a key can be wrong is refused", () => {
  assert.equal(checkClaims(null, want, DEFAULT_GATE, NOW), "invalid");
  assert.equal(checkClaims(claims({ s: "b" }), want, DEFAULT_GATE, NOW), "wrong_event");
  assert.equal(checkClaims(claims({ k: "screen" }), want, DEFAULT_GATE, NOW), "wrong_kind");
  assert.equal(checkClaims(claims({ nbf: NOW + 1 }), want, DEFAULT_GATE, NOW), "not_yet");
  assert.equal(checkClaims(claims({ exp: NOW }), want, DEFAULT_GATE, NOW), "expired");
  assert.equal(checkClaims(claims({ g: 0 }), want, { ...DEFAULT_GATE, gen: 1 }, NOW), "revoked");
  assert.equal(checkClaims(claims(), want, { ...DEFAULT_GATE, closed: true }, NOW), "closed");
});

test("a screen key can be accepted where a guest key is too", () => {
  assert.equal(checkClaims(claims({ k: "screen" }), { slug: "a", kinds: ["guest", "screen"] }, DEFAULT_GATE, NOW), "ok");
});

test("a printed key waits for the licence start and stops at its end", () => {
  const lic = { startsAt: new Date(NOW + 2 * HOUR).toISOString(), endsAt: new Date(NOW + 5 * HOUR).toISOString() };
  const w = keyWindow(lic, NOW, 48);
  assert.equal(w.nbf, NOW + 2 * HOUR);
  assert.equal(w.exp, NOW + 5 * HOUR);
});

test("a key without a licence window is capped", () => {
  const w = keyWindow({ startsAt: null, endsAt: null }, NOW, 10_000);
  assert.equal(w.exp, NOW + MAX_KEY_HOURS * HOUR);
});

test("a scan earns a cookie of a few hours, never past the key or the event", () => {
  const long = claims({ exp: NOW + 100 * HOUR });
  assert.equal(cookieWindow(long, { endsAt: null }, NOW).exp, NOW + COOKIE_HOURS * HOUR);
  assert.equal(cookieWindow(long, { endsAt: new Date(NOW + HOUR).toISOString() }, NOW).exp, NOW + HOUR);
  assert.equal(cookieWindow(claims({ exp: NOW + 30 * 60_000 }), { endsAt: null }, NOW).exp, NOW + 30 * 60_000);
});
