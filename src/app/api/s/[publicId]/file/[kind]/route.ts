import { jsonError, sendFile } from "@/lib/http";
import { eventOfPublicId } from "@/lib/platform/events";
import { withEvent } from "@/lib/platform/scope";
import { filePath, findByPublicId } from "@/lib/storage/submissions";
import type { SubmissionFiles } from "@/lib/types";

const KINDS = { image: ".png", cover: "_cover.png", mp3: ".mp3" } as const;

export async function GET(request: Request, ctx: RouteContext<"/api/s/[publicId]/file/[kind]">) {
  const { publicId, kind } = await ctx.params;
  if (!(kind in KINDS)) return jsonError("לא נמצא", 404);
  const slug = await eventOfPublicId(publicId);
  if (!slug) return jsonError("לא נמצא", 404);
  return withEvent(slug, async () => {
    // The hall screen loads its images through this route too; those keep working after a guest's link expires.
    const s = await findByPublicId(publicId, { forScreen: kind !== "mp3" });
    const rel = s?.files[kind as keyof SubmissionFiles];
    if (!s || !rel) return jsonError("לא נמצא", 404);
    const download = new URL(request.url).searchParams.has("download") ? `${s.id}${KINDS[kind as keyof typeof KINDS]}` : undefined;
    return sendFile(filePath(rel), { download });
  });
}
