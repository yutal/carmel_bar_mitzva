import { jsonError } from "@/lib/http";
import { queuePosition } from "@/lib/pipeline/queue";
import { eventOfPublicId } from "@/lib/platform/events";
import { withEvent } from "@/lib/platform/scope";
import { findByPublicId } from "@/lib/storage/submissions";
import { toPublic } from "@/lib/views";

export async function GET(_req: Request, ctx: RouteContext<"/api/s/[publicId]">) {
  const { publicId } = await ctx.params;
  const slug = await eventOfPublicId(publicId);
  if (!slug) return jsonError("לא נמצא", 404);
  return withEvent(slug, async () => {
    const s = await findByPublicId(publicId);
    if (!s) return jsonError("לא נמצא", 404);
    return Response.json({ ...toPublic(s, queuePosition(s.id) ?? undefined), event: slug }, { headers: { "Cache-Control": "no-store" } });
  });
}
