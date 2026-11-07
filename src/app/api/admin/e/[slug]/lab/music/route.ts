import { jsonError } from "@/lib/http";
import { removeMusic, setMusic } from "@/lib/lab/jobs";
import { eventAdminRoute } from "@/lib/platform/route";

export const POST = eventAdminRoute("owner", async (request) => {
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !file.size) return jsonError("לא נבחר קובץ");
  try {
    await setMusic(file);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "שגיאה בהעלאה", 422);
  }
  return Response.json({ music: true });
});

export const DELETE = eventAdminRoute("owner", async () => {
  await removeMusic();
  return Response.json({ music: false });
});
