import { queueStats } from "@/lib/pipeline/queue";
import { eventAdminRoute } from "@/lib/platform/route";
import { listSubmissions } from "@/lib/storage/submissions";

export const GET = eventAdminRoute("view", async () =>
  Response.json({ submissions: await listSubmissions(), queue: queueStats() }, { headers: { "Cache-Control": "no-store" } }),
);
