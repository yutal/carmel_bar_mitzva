import { jsonError } from "@/lib/http";
import { createLabJob, hasMusic, listLabJobs, MAX_LAB_UPLOAD_BYTES } from "@/lib/lab/jobs";

export async function GET() {
  const [jobs, music] = await Promise.all([listLabJobs(), hasMusic()]);
  return Response.json({ jobs, music }, { headers: { "Cache-Control": "no-store" } });
}

/** Multipart: file (video or audio), guestName, posterId (a submission whose poster opens the clip). */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return jsonError("לא נבחר קובץ");
  if (file.size > MAX_LAB_UPLOAD_BYTES) return jsonError("הקובץ גדול מ-200MB", 413);
  // The type is not checked here: phones label some formats loosely. ffprobe decides.
  const job = await createLabJob(file, String(form.get("guestName") ?? ""), String(form.get("posterId") ?? ""));
  return Response.json({ job }, { status: 201 });
}
