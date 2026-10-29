import { z } from "zod";
import { jsonError } from "@/lib/http";
import { eventStatus } from "@/lib/status";
import { saveBalance } from "@/lib/usage";

/** Event snapshot for the admin panel and the event-status skill. */
export async function GET() {
  return Response.json(await eventStatus(), { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({ amountUsd: z.number().min(0).max(100_000) });

/** Records the OpenAI balance shown on the billing page right now; later spend is subtracted from it. */
export async function PUT(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("סכום לא תקין", 422);
  await saveBalance({ amountUsd: body.data.amountUsd, setAt: new Date().toISOString() });
  return Response.json(await eventStatus());
}
