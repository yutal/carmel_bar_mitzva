import "server-only";
import { jsonError } from "@/lib/http";
import { eventExists } from "./events";
import { entryVerdict } from "./gate";
import { ENTRY_MESSAGES } from "./gate-rules";
import { BLOCK_MESSAGES } from "./license-rules";
import { LicenseError } from "./license";
import { can, type Actor, type Perm } from "./roles";
import { withEvent } from "./scope";
import { actorFromRequest } from "./session";
import { isSlug } from "./slug";

/**
 * Every API route goes through one of these wrappers. They are the security boundary: who is calling, whether they
 * may act on this event, and which event's files the handler can touch (it runs inside that event's scope, so a
 * path it builds cannot reach another event). src/lib/platform/routes.test.ts fails when an admin route skips them.
 */

type Params = Record<string, string | string[] | undefined>;
type Ctx = { params: Promise<Params> };
type Handler<T> = (request: Request, ctx: T) => Promise<Response>;

const str = (p: Params, k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");

/** Cross-site form posts are refused even with a valid cookie. SameSite=Lax already blocks most; this blocks the rest. */
function crossSite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function fail(err: unknown): Response {
  if (err instanceof LicenseError) {
    return Response.json({ error: BLOCK_MESSAGES[err.block].he, code: "license", block: err.block }, { status: 403 });
  }
  throw err;
}

async function signedIn(request: Request): Promise<Actor | Response> {
  if (crossSite(request)) return jsonError("בקשה ממקור זר נחסמה", 403);
  const actor = await actorFromRequest(request);
  return actor ?? jsonError("צריך להתחבר", 401);
}

/** Platform routes for anyone signed in (an operator sees only their own events). */
export function signedInRoute(handler: Handler<{ actor: Actor; params: Params }>) {
  return async (request: Request, ctx: Ctx) => {
    const actor = await signedIn(request);
    if (actor instanceof Response) return actor;
    return handler(request, { actor, params: await ctx.params }).catch(fail);
  };
}

/** Platform routes only the owner may call: accounts, licences, creating events. */
export function ownerRoute(handler: Handler<{ actor: Actor; params: Params }>) {
  return signedInRoute(async (request, c) => (c.actor.kind === "owner" ? handler(request, c) : jsonError("רק בעל הפלטפורמה", 403)));
}

/**
 * Admin routes under /api/admin/e/[slug]/…: the caller needs `perm` in this event. An event the caller has no
 * access to answers 404, the same as one that does not exist, so slugs cannot be probed.
 */
export function eventAdminRoute(perm: Perm, handler: Handler<{ actor: Actor; slug: string; params: Params }>) {
  return async (request: Request, ctx: Ctx) => {
    const actor = await signedIn(request);
    if (actor instanceof Response) return actor;
    const params = await ctx.params;
    const slug = str(params, "slug");
    if (!isSlug(slug) || !can(actor, slug, "view") || !(await eventExists(slug))) return jsonError("לא נמצא", 404);
    if (!can(actor, slug, perm)) return jsonError("אין לך הרשאה לפעולה הזאת", 403);
    return withEvent(slug, () => handler(request, { actor, slug, params })).catch(fail);
  };
}

/**
 * Guest routes under /api/e/[slug]/…: no login, but only events that exist, always inside their scope, and (unless
 * `entry: "none"`) only for someone who got in through the event's QR code. "guest" accepts a guest or hall-screen
 * cookie; "screen" accepts only the hall-screen cookie. Signed-in staff of the event pass without a cookie.
 * Every route states its `entry`, and routes.test.ts fails when one does not.
 */
export function publicEventRoute(handler: Handler<{ slug: string; params: Params }>, opts: { entry: "guest" | "screen" | "none" }) {
  return async (request: Request, ctx: Ctx) => {
    if (crossSite(request)) return jsonError("בקשה ממקור זר נחסמה", 403);
    const params = await ctx.params;
    const slug = str(params, "slug");
    if (!isSlug(slug) || !(await eventExists(slug))) return jsonError("לא נמצא", 404);
    return withEvent(slug, async () => {
      if (opts.entry !== "none") {
        const verdict = await entryVerdict(request, opts.entry === "screen" ? ["screen"] : ["guest", "screen"]);
        if (verdict !== "ok") {
          const actor = await actorFromRequest(request);
          if (!actor || !can(actor, slug, "view")) {
            return Response.json({ error: ENTRY_MESSAGES[verdict].he, message: ENTRY_MESSAGES[verdict], code: "entry", reason: verdict }, { status: 403, headers: { "Cache-Control": "no-store" } });
          }
        }
      }
      return handler(request, { slug, params });
    }).catch(fail);
  };
}
