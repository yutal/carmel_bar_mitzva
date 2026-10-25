import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getSubmission, updateSubmission } from "@/lib/storage/submissions";

const Body = z.object({ hidden: z.boolean() });

export async function POST(request: Request, ctx: RouteContext<"/api/admin/submissions/[id]/visibility">) {
  const { id } = await ctx.params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה");
  if (!(await getSubmission(id))) return jsonError("לא נמצא", 404);
  await updateSubmission(id, (s) => {
    s.hidden = body.data.hidden;
  });
  return Response.json({ ok: true });
}
