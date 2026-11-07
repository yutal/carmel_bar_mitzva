import { readAudit } from "@/lib/platform/audit";
import { ownerRoute } from "@/lib/platform/route";

export const GET = ownerRoute(async () => Response.json({ entries: await readAudit() }, { headers: { "Cache-Control": "no-store" } }));
