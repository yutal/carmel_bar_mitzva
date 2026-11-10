import { jsonError } from "@/lib/http";
import { readUpload, UploadError } from "@/lib/images";
import { getLicense } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { getTheme, removeLogo, saveLogo, saveTheme } from "@/lib/storage/theme";

export const POST = eventAdminRoute("manage", async (request) => {
  if (!(await getLicense()).customTheme) return jsonError("לוגו אישי לא כלול ברישיון של האירוע", 403);
  try {
    const raw = await readUpload((await request.formData()).get("logo") as File | null);
    if (!raw) return jsonError("לא נבחר קובץ");
    await saveLogo(raw);
  } catch (err) {
    return jsonError(err instanceof UploadError ? err.message : "הקובץ אינו תמונה תקינה", 422);
  }
  await saveTheme({ ...(await getTheme()), hasLogo: true });
  return Response.json({ ok: true });
});

export const DELETE = eventAdminRoute("manage", async () => {
  await removeLogo();
  await saveTheme({ ...(await getTheme()), hasLogo: false });
  return Response.json({ ok: true });
});
