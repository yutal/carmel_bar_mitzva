import { jsonError } from "@/lib/http";
import { getSubmission, saveFile, setStage } from "@/lib/storage/submissions";

const MAX_MP3_BYTES = 30 * 1024 * 1024;

/** Uploads the MP3 an organiser produced in Suno for this submission. */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/submissions/[id]/song">) {
  const { id } = await ctx.params;
  const s = await getSubmission(id);
  if (!s?.stages.song) return jsonError("לא נמצא", 404);
  const file = (await request.formData()).get("mp3");
  if (!(file instanceof File) || file.size === 0) return jsonError("חסר קובץ");
  if (file.size > MAX_MP3_BYTES) return jsonError("הקובץ גדול מדי");
  const data = Buffer.from(await file.arrayBuffer());
  const isMp3 = data.subarray(0, 3).toString("latin1") === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
  if (!isMp3) return jsonError("זה לא קובץ MP3");
  await saveFile(id, "mp3", "songs", ".mp3", data);
  await setStage(id, "song", "done");
  return Response.json({ ok: true });
}
