import { NextResponse } from "next/server";
import { entryCookieHeader, cookieName, redeemKey } from "@/lib/platform/gate";
import { eventExists } from "@/lib/platform/events";
import { withEvent } from "@/lib/platform/scope";
import { isSlug } from "@/lib/platform/slug";
import { isLang } from "@/lib/i18n";

/**
 * The address inside every QR code: /e/<slug>/in?k=<signed key>. A good key is traded for an entry cookie and the
 * visitor lands on the clean guest page (or the hall screen, for a screen key). A bad, expired or replaced key
 * lands on the same page without a cookie, which then asks them to scan the code again. Nothing here says why a
 * key failed, so it cannot be used to probe.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isSlug(slug) || !(await eventExists(slug))) return new NextResponse("Not found", { status: 404 });
  const url = new URL(request.url);
  const result = await withEvent(slug, () => redeemKey(url.searchParams.get("k")));
  const lang = url.searchParams.get("lang");
  const base = `${request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.replace(":", "")}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host}`;
  const target = new URL(`/e/${slug}${result.kind === "screen" ? "/screen" : ""}`, base);
  if (isLang(lang) && lang !== "he") target.searchParams.set("lang", lang);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (result.cookie && result.kind && result.maxAge) {
    response.headers.append("Set-Cookie", entryCookieHeader(cookieName(result.kind, slug), result.cookie, result.maxAge));
  }
  return response;
}
