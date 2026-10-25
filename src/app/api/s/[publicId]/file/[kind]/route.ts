import { jsonError, sendFile } from "@/lib/http";
import { filePath, findByPublicId } from "@/lib/storage/submissions";
import type { SubmissionFiles } from "@/lib/types";

const KINDS = { image: ".png", cover: "_cover.png", mp3: ".mp3" } as const;

export async function GET(request: Request, ctx: RouteContext<"/api/s/[publicId]/file/[kind]">) {
  const { publicId, kind } = await ctx.params;
  if (!(kind in KINDS)) return jsonError("לא נמצא", 404);
  const s = await findByPublicId(publicId);
  const rel = s?.files[kind as keyof SubmissionFiles];
  if (!s || !rel) return jsonError("לא נמצא", 404);
  const download = new URL(request.url).searchParams.has("download")
    ? `${s.id}${KINDS[kind as keyof typeof KINDS]}`
    : undefined;
  return sendFile(filePath(rel), { download });
}
