import { z } from "zod";
import { jsonError } from "@/lib/http";
import { regenerate } from "@/lib/pipeline/queue";
import { getSubmission } from "@/lib/storage/submissions";

const Body = z.object({ stage: z.enum(["analysis", "image", "song"]), newConcept: z.boolean().default(true) });

export async function POST(request: Request, ctx: RouteContext<"/api/admin/submissions/[id]/regenerate">) {
  const { id } = await ctx.params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה");
  if (!(await getSubmission(id))) return jsonError("לא נמצא", 404);
  try {
    await regenerate(id, body.data.stage, body.data.newConcept);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "שגיאה");
  }
  return Response.json({ ok: true });
}
