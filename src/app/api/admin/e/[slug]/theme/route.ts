import { jsonError } from "@/lib/http";
import { audit } from "@/lib/platform/audit";
import { getLicense } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { ThemeSchema } from "@/lib/platform/theme-rules";
import { getTheme, saveTheme } from "@/lib/storage/theme";

export const GET = eventAdminRoute("view", async () => {
  const [theme, license] = await Promise.all([getTheme(), getLicense()]);
  return Response.json({ theme, custom: license.customTheme }, { headers: { "Cache-Control": "no-store" } });
});

/** A ready theme is always allowed; colour overrides, fonts and a headline need a licence with customTheme. */
export const PUT = eventAdminRoute("manage", async (request, { actor, slug }) => {
  const body = ThemeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("עיצוב לא תקין", 422);
  const [license, current] = await Promise.all([getLicense(), getTheme()]);
  const wantsCustom = Object.keys(body.data.colors).length > 0 || body.data.fonts !== undefined || body.data.headline !== "";
  if (wantsCustom && !license.customTheme) return jsonError("התאמה אישית של העיצוב לא כלולה ברישיון של האירוע", 403);
  // The logo flag is set only by the logo upload, never by a client claiming it.
  const theme = { ...body.data, hasLogo: current.hasLogo };
  await saveTheme(theme);
  await audit(actor, "theme.update", { event: slug, detail: theme.preset });
  return Response.json({ theme });
});
