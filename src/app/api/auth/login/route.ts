import { z } from "zod";
import { config } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { findByUsername, mutateAccounts } from "@/lib/platform/accounts";
import { audit, clientIp } from "@/lib/platform/audit";
import { checkPassword } from "@/lib/platform/password";
import { safeEqual } from "@/lib/platform/secret";
import { createSessionToken, sessionCookie } from "@/lib/platform/session";
import { clearLoginFailures, loginLocked, recordLoginFailure } from "@/lib/platform/throttle";

const Body = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) });

// Compared against when the name is unknown, so a wrong name takes as long as a wrong password.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && new URL(origin).host !== host) return jsonError("בקשה ממקור זר נחסמה", 403);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("חסרים שם משתמש או סיסמה", 422);
  const username = body.data.username.toLowerCase();
  const ip = clientIp(request);
  const keys = [`u:${username}`, `ip:${ip}`];
  if (loginLocked(keys)) {
    await audit(username, "login.locked", { ip });
    return jsonError("יותר מדי ניסיונות. נסו שוב בעוד רבע שעה", 429);
  }

  let sub: string | null = null;
  let version = 0;
  if (config.adminPassword && username === config.ownerUsername.toLowerCase()) {
    if (safeEqual(body.data.password, config.adminPassword)) sub = "owner";
  } else {
    const account = await findByUsername(username);
    const ok = await checkPassword(body.data.password, account?.passwordHash ?? DUMMY_HASH);
    if (account && ok && !account.disabled) {
      sub = account.id;
      version = account.sessionVersion;
      await mutateAccounts((all) => {
        const a = all.find((x) => x.id === account.id);
        if (a) a.lastLoginAt = new Date().toISOString();
      });
    }
  }

  if (!sub) {
    recordLoginFailure(keys);
    await audit(username, "login.failed", { ip });
    return jsonError("שם משתמש או סיסמה שגויים", 401);
  }
  clearLoginFailures(keys);
  await audit(sub === "owner" ? `owner:${username}` : `operator:${username}`, "login", { ip });
  const token = createSessionToken(sub, version);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(token, config.sessionHours * 3600) },
  });
}
