import { jsonError } from "@/lib/http";
import { deleteLabJob, getLabJob } from "@/lib/lab/jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const job = await getLabJob((await params).id);
  if (!job) return jsonError("לא נמצא", 404);
  return Response.json({ job }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteLabJob((await params).id);
  return Response.json({ ok: true });
}
