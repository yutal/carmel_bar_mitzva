import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import { config } from "@/lib/config";
import { platformPath } from "@/lib/storage/fs";

let cached: Buffer | undefined;

/**
 * The key that signs sessions and licences. AUTH_SECRET wins; otherwise a random key is made once and kept in
 * DATA_DIR/platform/secret.key (readable by the server user only), so it survives restarts on a persistent disk.
 */
export function authSecret(): Buffer {
  if (cached) return cached;
  if (config.authSecret) return (cached = Buffer.from(config.authSecret, "utf8"));
  const file = platformPath("secret.key");
  try {
    cached = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64url");
  } catch {
    fs.mkdirSync(platformPath(), { recursive: true });
    const key = randomBytes(48).toString("base64url");
    try {
      fs.writeFileSync(file, key, { mode: 0o600, flag: "wx" });
    } catch {
      // Another request created it first; use theirs.
    }
    cached = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64url");
  }
  if (cached.length < 32) throw new Error("secret.key is too short");
  return cached;
}

/** HMAC-SHA256 of the value under the auth secret, with a purpose label so a session can never pass as a licence. */
export function sign(purpose: string, value: string): string {
  return createHmac("sha256", authSecret()).update(`${purpose}\n${value}`).digest("base64url");
}

export function verify(purpose: string, value: string, signature: string): boolean {
  const expected = Buffer.from(sign(purpose, value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Constant-time string comparison for passwords given in the environment. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}
