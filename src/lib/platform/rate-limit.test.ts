import assert from "node:assert/strict";
import { test } from "node:test";
import { createLimiter } from "./rate-limit";

test("allows up to the limit, then refuses with a wait time", () => {
  const l = createLimiter();
  for (let i = 0; i < 3; i++) assert.equal(l.hit("a", 3, 60_000, 1000 + i).ok, true);
  const r = l.hit("a", 3, 60_000, 2000);
  assert.equal(r.ok, false);
  assert.equal(r.retryAfterSeconds, 59);
});

test("keys are independent and the window slides", () => {
  const l = createLimiter();
  l.hit("a", 1, 1000, 0);
  assert.equal(l.hit("b", 1, 1000, 0).ok, true);
  assert.equal(l.hit("a", 1, 1000, 500).ok, false);
  assert.equal(l.hit("a", 1, 1000, 1001).ok, true);
});
