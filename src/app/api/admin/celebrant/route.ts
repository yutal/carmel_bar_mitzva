import { readUpload, UploadError } from "@/lib/images";
import { jsonError } from "@/lib/http";
import { addCelebrantPhoto, listCelebrantPhotos, removeCelebrantPhoto } from "@/lib/storage/event";

export async function GET() {
  return Response.json({ photos: await listCelebrantPhotos() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
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
}

export async function DELETE(request: Request) {
  const name = new URL(request.url).searchParams.get("name");
  if (!name) return jsonError("חסר שם");
  await removeCelebrantPhoto(name);
  return Response.json({ photos: await listCelebrantPhotos() });
}
