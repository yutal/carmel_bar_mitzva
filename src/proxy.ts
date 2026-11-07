import fs from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

/** The slug in platform.json, read without the app's server-only modules (a proxy is a separate bundle). */
function defaultEvent(): string | undefined {
  try {
    const file = path.resolve(process.env.DATA_DIR ?? "./data", "platform", "platform.json");
    const slug = (JSON.parse(fs.readFileSync(file, "utf8")) as { defaultEvent?: string }).defaultEvent;
    return slug && /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(slug) ? slug : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Two jobs.
 * 1. The site root and /screen open the default event with a real redirect, so QR codes printed before events
 *    existed keep working at once. (The pages do the same as a fallback.)
 * 2. First gate in front of the admin pages and API: no session cookie, no entry. This only checks that a cookie is
 *    there; the real check (signature, expiry, account still active, access to this event and this action) runs in
 *    every admin page and API route through lib/platform/page-auth.ts and lib/platform/route.ts.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/" || pathname === "/screen") {
    const slug = defaultEvent();
    if (slug) return NextResponse.redirect(new URL(`/e/${slug}${pathname === "/screen" ? "/screen" : ""}${search}`, request.url), 307);
    return NextResponse.next();
  }
  if (request.cookies.get("bm_session")?.value) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/", "/screen", "/admin/:path*", "/api/admin/:path*"] };
