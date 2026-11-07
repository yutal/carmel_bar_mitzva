import { z } from "zod";
import { jsonError } from "@/lib/http";
import { audit } from "@/lib/platform/audit";
import { createEvent, EventExistsError } from "@/lib/platform/events";
import { LicenseSchema } from "@/lib/platform/license-rules";
import { ownerRoute, signedInRoute } from "@/lib/platform/route";
import { SLUG_RE } from "@/lib/platform/slug";
import { eventSummaries } from "@/lib/platform/summary";
import { DEFAULT_EVENT } from "@/lib/types";

/** The events the caller may see, with their licence state. */
export const GET = signedInRoute(async (_request, { actor }) =>
  Response.json({ events: await eventSummaries(actor) }, { headers: { "Cache-Control": "no-store" } }),
);

const Body = z.object({
  slug: z.string().regex(SLUG_RE),
  eventTitle: z.string().trim().min(1).max(80),
  celebrantName: z.string().trim().max(40).default(""),
  celebrantNameEn: z.string().trim().max(40).default(""),
  eventDate: z.string().trim().max(40).default(""),
  license: LicenseSchema,
});

/** Owner only: opens a new event with its licence. */
export const POST = ownerRoute(async (request, { actor }) => {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("פרטים לא תקינים: כתובת באותיות לטיניות קטנות, ספרות ומקפים", 422);
  const { slug, license, ...details } = body.data;
  try {
    await createEvent(slug, { ...DEFAULT_EVENT, ...details, footer: details.eventTitle, footerEn: "" }, license);
  } catch (err) {
    if (err instanceof EventExistsError) return jsonError("כבר יש אירוע בכתובת הזאת", 409);
    throw err;
  }
  await audit(actor, "event.create", { event: slug, detail: JSON.stringify({ tools: license.tools, mode: license.mode }) });
  return Response.json({ slug }, { status: 201 });
});
