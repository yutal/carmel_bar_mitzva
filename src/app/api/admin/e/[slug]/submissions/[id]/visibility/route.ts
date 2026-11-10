import { z } from "zod";
import { jsonError } from "@/lib/http";
import { eventAdminRoute } from "@/lib/platform/route";
import { getSubmission, updateSubmission } from "@/lib/storage/submissions";

const Body = z.object({ hidden: z.boolean().optional(), test: z.boolean().optional() });

export const POST = eventAdminRoute("moderate", async (request, { params }) => {
  const id = String(params.id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה");
  if (!(await getSubmission(id))) return jsonError("לא נמצא", 404);
  await updateSubmission(id, (s) => {
    if (body.data.hidden !== undefined) s.hidden = body.data.hidden;
    if (body.data.test !== undefined) s.test = body.data.test;
  });
  return Response.json({ ok: true });
});
