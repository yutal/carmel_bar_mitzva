import { enqueue } from "@/lib/pipeline/queue";
import { readUpload, UploadError } from "@/lib/images";
import { jsonError } from "@/lib/http";
import { createSubmission, saveFile } from "@/lib/storage/submissions";
import { GuestInputSchema } from "@/lib/types";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("בקשה לא תקינה");
  }
  const text = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : undefined);
  const parsed = GuestInputSchema.safeParse({
    fullName: text("fullName"),
    relationship: text("relationship"),
    together: text("together"),
    memory: text("memory"),
    talent: text("talent"),
    blessing: text("blessing"),
    experience: text("experience"),
    musicStyle: text("musicStyle") || undefined,
    consentPhoto: text("consentPhoto") === "true",
    consentScreen: text("consentScreen") === "true",
  });
  if (!parsed.success) return jsonError("חסרים פרטים בטופס", 422);

  let photo: Buffer | undefined;
  try {
    photo = parsed.data.consentPhoto ? await readUpload(form.get("photo") as File | null) : undefined;
  } catch (err) {
    return jsonError(err instanceof UploadError ? err.message : "שגיאה בהעלאת התמונה", 422);
  }

  const submission = await createSubmission(parsed.data);
  if (photo) await saveFile(submission.id, "photo", "uploads", ".jpg", photo);
  enqueue(submission.id);
  return Response.json({ publicId: submission.publicId }, { status: 201 });
}
