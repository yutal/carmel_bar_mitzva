import assert from "node:assert/strict";
import { test } from "node:test";
import { canonical, licenseBlock, LicenseSchema, LOCKED_LICENSE, unlimitedLicense } from "./license-rules";
import { splitPublicId } from "./slug";

const none = { creations: 0, spentUsd: 0 };
const lic = (over: object) => LicenseSchema.parse({ tools: ["blessings"], ...over });

test("a missing or tampered licence closes everything", () => {
  assert.equal(licenseBlock(LOCKED_LICENSE, "blessings", none), "suspended");
  assert.equal(licenseBlock({ ...unlimitedLicense(), tampered: true }, "blessings", none), "tampered");
});

test("guests can create only inside the window", () => {
  const l = lic({ startsAt: "2026-11-07T18:00:00+02:00", endsAt: "2026-11-08T02:00:00+02:00" });
  assert.equal(licenseBlock(l, "blessings", none, Date.parse("2026-11-07T17:59:00+02:00")), "not_started");
  assert.equal(licenseBlock(l, "blessings", none, Date.parse("2026-11-07T21:00:00+02:00")), null);
  assert.equal(licenseBlock(l, "blessings", none, Date.parse("2026-11-08T02:01:00+02:00")), "ended");
});

test("only licensed, live tools are open", () => {
  assert.equal(licenseBlock(lic({}), "print", none), "tool_off");
  assert.equal(licenseBlock(lic({ tools: ["blessings", "video"] }), "video", none), "tool_off", "a tool in research cannot be switched on");
});

test("the quota stops new creations and the budget stops all paid work", () => {
  const l = lic({ maxCreations: 100, budgetUsd: 50 });
  assert.equal(licenseBlock(l, "blessings", { creations: 100, spentUsd: 10 }, Date.now(), { creating: true }), "quota");
  assert.equal(licenseBlock(l, "blessings", { creations: 100, spentUsd: 10 }), null, "a regeneration is not a new creation");
  assert.equal(licenseBlock(l, "blessings", { creations: 3, spentUsd: 50 }), "budget");
});

test("the signed form does not depend on key order", () => {
  const a = lic({ maxCreations: 5, note: "x" });
  const b = LicenseSchema.parse(Object.fromEntries(Object.entries(a).reverse()));
  assert.equal(canonical(a), canonical(b));
  assert.notEqual(canonical(a), canonical({ ...a, maxCreations: 6 }));
});

test("a guest link carries its event", () => {
  assert.deepEqual(splitPublicId("cohen-wedding.AbCdEf123_-xyz"), { slug: "cohen-wedding", token: "AbCdEf123_-xyz" });
  assert.deepEqual(splitPublicId("AbCdEf123_-xyzQRS"), { token: "AbCdEf123_-xyzQRS" }, "links made before events");
  assert.equal(splitPublicId("../etc.passwd"), undefined);
  assert.equal(splitPublicId("Bad_Slug.abcdefgh"), undefined);
});

test("the organiser's tools ignore the guests' window but not suspension or the licence's tool list", () => {
  const ended = lic({ endsAt: "2020-01-01T00:00:00Z" });
  assert.equal(licenseBlock(ended, "blessings", none), "ended");
  assert.equal(licenseBlock(ended, "blessings", none, Date.now(), { staff: true }), null);
  assert.equal(licenseBlock(lic({ suspended: true }), "blessings", none, Date.now(), { staff: true }), "suspended");
  assert.equal(licenseBlock(ended, "print", none, Date.now(), { staff: true }), "tool_off");
});
