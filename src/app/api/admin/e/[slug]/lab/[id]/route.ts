import { jsonError } from "@/lib/http";
import { deleteLabJob, getLabJob } from "@/lib/lab/jobs";
import { eventAdminRoute } from "@/lib/platform/route";

export const GET = eventAdminRoute("owner", async (_request, { params }) => {
  const job = await getLabJob(String(params.id));
  if (!job) return jsonError("לא נמצא", 404);
  return Response.json({ job }, { headers: { "Cache-Control": "no-store" } });
});

export const DELETE = eventAdminRoute("owner", async (_request, { params }) => {
  await deleteLabJob(String(params.id));
  return Response.json({ ok: true });
});
