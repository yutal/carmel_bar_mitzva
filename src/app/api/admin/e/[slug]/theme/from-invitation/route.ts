import { jsonError } from "@/lib/http";
import { readUpload, UploadError } from "@/lib/images";
import { audit } from "@/lib/platform/audit";
import { getLicense, licenseUsage } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { designThemeFromImage, takeDesignSlot } from "@/lib/platform/theme-design";
import { providers } from "@/lib/providers";

export const maxDuration = 120;

/**
 * Invitation (or any branding picture) in, a theme to preview out. Nothing is saved here: the organiser looks at the
 * result and saves it with the normal theme save, which applies the licence rules again. The picture itself is not kept.
 */
export const POST = eventAdminRoute("manage", async (request, { actor, slug }) => {
  const license = await getLicense();
  if (!license.customTheme) return jsonError("יצירת עיצוב מהזמנה לא כלולה ברישיון של האירוע", 403);

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("בקשה לא תקינה", 400);
  let image: Buffer | undefined;
  try {
    image = await readUpload(form.get("image") as File | null);
  } catch (err) {
    return jsonError(err instanceof UploadError ? err.message : "הקובץ אינו תמונה תקינה", 422);
  }
  if (!image) return jsonError("לא נבחרה תמונה");
  // Counted only for a real picture, so a mistyped file does not use up the hour's tries.
  if (!takeDesignSlot(slug)) return jsonError("יותר מדי ניסיונות בשעה האחרונה. נסו שוב מאוחר יותר", 429);

  // An event past its AI budget still gets a theme, made from the picture's colours without the model.
  const spent = (await licenseUsage()).spentUsd;
  const useAi = !(license.budgetUsd > 0 && spent >= license.budgetUsd);
  const hint = typeof form.get("hint") === "string" ? (form.get("hint") as string) : "";

  try {
    const design = await designThemeFromImage(image, { hint, useAi, propose: providers.llm.themeFromImage });
    await audit(actor, "theme.design", { event: slug, detail: design.source });
    return Response.json({ design }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[theme-design]", err);
    return jsonError("לא הצלחנו לקרוא צבעים מהתמונה", 422);
  }
});
