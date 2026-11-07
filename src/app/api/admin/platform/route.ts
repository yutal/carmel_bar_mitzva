import { z } from "zod";
import { jsonError } from "@/lib/http";
import { audit } from "@/lib/platform/audit";
import { eventExists, getPlatform, savePlatform } from "@/lib/platform/events";
import { ownerRoute } from "@/lib/platform/route";
import { SLUG_RE } from "@/lib/platform/slug";

export const GET = ownerRoute(async () => Response.json(await getPlatform(), { headers: { "Cache-Control": "no-store" } }));

const Body = z.object({ defaultEvent: z.string().regex(SLUG_RE) });

/** Which event the site root opens. */
export const PUT = ownerRoute(async (request, { actor }) => {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !(await eventExists(body.data.defaultEvent))) return jsonError("אירוע לא קיים", 422);
  await savePlatform({ ...(await getPlatform()), defaultEvent: body.data.defaultEvent });
  await audit(actor, "platform.default", { event: body.data.defaultEvent });
  return Response.json(await getPlatform());
});
