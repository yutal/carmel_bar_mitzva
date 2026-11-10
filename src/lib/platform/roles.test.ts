import assert from "node:assert/strict";
import { test } from "node:test";
import { can, type Actor } from "./roles";

const owner: Actor = { kind: "owner", name: "guy" };
const op: Actor = { kind: "operator", id: "1", username: "dana", name: "Dana", events: { "cohen-wedding": "manager", "tech-conf": "viewer" } };

test("the owner can do everything, in every event", () => {
  for (const p of ["view", "moderate", "manage", "owner"] as const) assert.equal(can(owner, "anything", p), true);
});

test("an operator can act only in the events given to them, within their role", () => {
  assert.equal(can(op, "cohen-wedding", "manage"), true);
  assert.equal(can(op, "cohen-wedding", "owner"), false, "licence and accounts stay with the owner");
  assert.equal(can(op, "tech-conf", "view"), true);
  assert.equal(can(op, "tech-conf", "moderate"), false);
  assert.equal(can(op, "other-event", "view"), false);
  assert.equal(can(null, "cohen-wedding", "view"), false);
});
