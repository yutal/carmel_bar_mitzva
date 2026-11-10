import { readUpload, UploadError } from "@/lib/images";
import { jsonError } from "@/lib/http";
import { eventAdminRoute } from "@/lib/platform/route";
import { addCelebrantPhoto, listCelebrantPhotos, removeCelebrantPhoto } from "@/lib/storage/event";

export const GET = eventAdminRoute("view", async () =>
  Response.json({ photos: await listCelebrantPhotos() }, { headers: { "Cache-Control": "no-store" } }),
);

export const POST = eventAdminRoute("manage", async (request) => {
  const files = (await request.formData()).getAll("photos").filter((f): f is File => f instanceof File);
  if (!files.length) return jsonError("לא נבחרו תמונות");
  try {
    for (const f of files) {
      const jpeg = await readUpload(f);
      if (jpeg) await addCelebrantPhoto(jpeg);
    }
  } catch (err) {
    return jsonError(err instanceof UploadError ? err.message : "שגיאה בהעלאה", 422);
  }
  return Response.json({ photos: await listCelebrantPhotos() });
});

export const DELETE = eventAdminRoute("manage", async (request) => {
  const name = new URL(request.url).searchParams.get("name");
  if (!name) return jsonError("חסר שם");
  await removeCelebrantPhoto(name);
  return Response.json({ photos: await listCelebrantPhotos() });
});
