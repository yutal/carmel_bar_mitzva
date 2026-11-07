import { z } from "zod";
import { jsonError } from "@/lib/http";
import { regenerate } from "@/lib/pipeline/queue";
import { assertTool } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { getSubmission } from "@/lib/storage/submissions";

const Body = z.object({ stage: z.enum(["analysis", "image", "song"]), newConcept: z.boolean().default(true) });

export const POST = eventAdminRoute("moderate", async (request, { params }) => {
  const id = String(params.id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה");
  if (!(await getSubmission(id))) return jsonError("לא נמצא", 404);
  // A regeneration is paid AI work: it needs a live licence with budget left, like a guest's creation.
  await assertTool("blessings", { staff: true });
  try {
    await regenerate(id, body.data.stage, body.data.newConcept);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "שגיאה");
  }
  return Response.json({ ok: true });
});
