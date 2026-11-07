import { z } from "zod";
import { jsonError } from "@/lib/http";
import { eventAdminRoute } from "@/lib/platform/route";
import { eventStatus } from "@/lib/status";
import { saveBalance } from "@/lib/usage";

/** Event snapshot for the admin panel and the event-status skill. Money is shown to the owner only. */
export const GET = eventAdminRoute("view", async (_request, { actor }) =>
  Response.json(await eventStatus({ money: actor.kind === "owner" }), { headers: { "Cache-Control": "no-store" } }),
);

const Body = z.object({ amountUsd: z.number().min(0).max(100_000) });

/** Records the OpenAI balance shown on the billing page right now; later spend, in every event, is subtracted from it. */
export const PUT = eventAdminRoute("owner", async (request) => {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("סכום לא תקין", 422);
  await saveBalance({ amountUsd: body.data.amountUsd, setAt: new Date().toISOString() });
  return Response.json(await eventStatus({ money: true }));
});
