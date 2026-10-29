import { jsonError } from "@/lib/http";
import { removeMusic, setMusic } from "@/lib/lab/jobs";

export async function POST(request: Request) {
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !file.size) return jsonError("לא נבחר קובץ");
  try {
    await setMusic(file);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "שגיאה בהעלאה", 422);
  }
  return Response.json({ music: true });
}

export async function DELETE() {
  await removeMusic();
  return Response.json({ music: false });
}
