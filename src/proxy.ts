import { NextResponse, type NextRequest } from "next/server";

/**
 * First gate in front of the admin pages and API: no session cookie, no entry. This only checks that a cookie is
 * there; the real check (signature, expiry, account still active, access to this event and this action) runs in
 * every admin page and API route through lib/platform/page-auth.ts and lib/platform/route.ts.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get("bm_session")?.value) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
