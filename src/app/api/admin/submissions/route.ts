import { queueStats } from "@/lib/pipeline/queue";
import { listSubmissions } from "@/lib/storage/submissions";

export async function GET() {
  return Response.json({ submissions: await listSubmissions(), queue: queueStats() }, { headers: { "Cache-Control": "no-store" } });
}
