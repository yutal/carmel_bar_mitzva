import { getChoir, startChoir } from "@/lib/lab/choir";
import { eventAdminRoute } from "@/lib/platform/route";

export const GET = eventAdminRoute("owner", async () =>
  Response.json({ choir: (await getChoir()) ?? null }, { headers: { "Cache-Control": "no-store" } }),
);

/** Builds the "mazal tov choir" from every finished lab recording. */
export const POST = eventAdminRoute("owner", async () => Response.json({ choir: await startChoir() }, { status: 202 }));
