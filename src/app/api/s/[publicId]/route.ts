import { jsonError } from "@/lib/http";
import { queuePosition } from "@/lib/pipeline/queue";
import { findByPublicId } from "@/lib/storage/submissions";
import { toPublic } from "@/lib/views";

export async function GET(_req: Request, ctx: RouteContext<"/api/s/[publicId]">) {
  const { publicId } = await ctx.params;
  const s = await findByPublicId(publicId);
  if (!s) return jsonError("לא נמצא", 404);
  return Response.json(toPublic(s, queuePosition(s.id) ?? undefined), { headers: { "Cache-Control": "no-store" } });
}
