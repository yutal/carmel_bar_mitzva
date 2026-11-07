import { enqueue } from "@/lib/pipeline/queue";
import { readUpload, UploadError } from "@/lib/images";
import { jsonError } from "@/lib/http";
import { getEvent } from "@/lib/storage/event";
import { config } from "@/lib/config";
import { createSubmission, remainingFor, saveFile } from "@/lib/storage/submissions";
import { inappropriateField } from "@/lib/moderation";
import { getLicense, licenseUsage } from "@/lib/platform/license";
import { BLOCK_MESSAGES, licenseBlock } from "@/lib/platform/license-rules";
import { can } from "@/lib/platform/roles";
import { publicEventRoute } from "@/lib/platform/route";
import { actorFromRequest } from "@/lib/platform/session";
import { GuestInputSchema } from "@/lib/types";

export const POST = publicEventRoute(async (request, { slug }) => {
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
    imageStyle: text("imageStyle") || undefined,
    lang: text("lang") || undefined,
    musicStyle: text("musicStyle") || undefined,
    consentPhoto: text("consentPhoto") === "true",
    consentScreen: text("consentScreen") === "true",
    consentMarketing: text("consentMarketing") === "true",
  });
  if (!parsed.success) return jsonError("חסרים פרטים בטופס", 422);
  // Stops before anything is stored or painted. The page words the message in the guest's language and goes back to the field.
  const field = await inappropriateField(parsed.data);
  if (field) return Response.json({ error: "התוכן אינו מתאים לאירוע", code: "inappropriate", field }, { status: 422 });

  // The licence decides whether guests may create right now. A blessing alone costs nothing and stays open while
  // the window is open, even after the creation quota or budget is used up.
  const wantsCreation = parsed.data.experience !== "blessing";
  const block = licenseBlock(await getLicense(), "blessings", await licenseUsage(), Date.now(), { creating: wantsCreation });
  // The organiser can try the flow outside the window (a rehearsal); what they make is marked as a test.
  const rehearsal = (block === "not_started" || block === "ended") && can(await actorFromRequest(request), slug, "moderate");
  if (block && !rehearsal) {
    const lang = parsed.data.lang ?? "he";
    return Response.json({ error: BLOCK_MESSAGES[block][lang], code: "closed", block }, { status: 403 });
  }

  if (wantsCreation && (await remainingFor(parsed.data.fullName)) === 0) {
    return jsonError(`כבר יצרת ${config.maxCreationsPerGuest} יצירות, וזה המקסימום לאורח. תודה שבירכת!`, 429);
  }

  let photo: Buffer | undefined;
  try {
    photo = parsed.data.consentPhoto ? await readUpload(form.get("photo") as File | null) : undefined;
  } catch (err) {
    return jsonError(err instanceof UploadError ? err.message : "שגיאה בהעלאת התמונה", 422);
  }

  // With songs switched off, a song request becomes a poster, whatever an old page sent.
  const songsOff = !(await getEvent()).songsEnabled && (parsed.data.experience === "song" || parsed.data.experience === "both");
  const input = songsOff ? { ...parsed.data, experience: "image" as const } : parsed.data;
  const submission = await createSubmission(input, { test: rehearsal });
  if (photo) await saveFile(submission.id, "photo", "uploads", ".jpg", photo);
  enqueue(submission.id);
  return Response.json({ publicId: submission.publicId }, { status: 201 });
});
