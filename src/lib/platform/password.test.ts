import assert from "node:assert/strict";
import { scryptSync, randomBytes } from "node:crypto";
import { test } from "node:test";
import { checkPassword, hashPassword } from "./password";

test("a new hash verifies, a wrong password does not, and two hashes of one password differ (salt)", async () => {
  const a = await hashPassword("correct horse");
  assert.ok(await checkPassword("correct horse", a));
  assert.ok(!(await checkPassword("wrong", a)));
  assert.notEqual(a, await hashPassword("correct horse"));
});

test("hashes made with the old, cheaper cost still verify", async () => {
  const salt = randomBytes(16);
  const key = scryptSync("old-pass", salt, 32, { N: 16384, r: 8, p: 1 });
  const stored = ["scrypt", 16384, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$");
  assert.ok(await checkPassword("old-pass", stored));
});
