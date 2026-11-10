import { jsonError } from "@/lib/http";
import { actorLabel, audit } from "@/lib/platform/audit";
import { BriefInputSchema } from "@/lib/platform/design-brief";
import { eventAdminRoute } from "@/lib/platform/route";
import { getBrief, updateBrief } from "@/lib/storage/design";
import { getTheme } from "@/lib/storage/theme";

const MAX_BODY = 200_000;

/** The organiser's design brief and the event's theme (for the preview). Everyone with access to the event may read it. */
export const GET = eventAdminRoute("view", async (_request, { slug }) => {
  const [brief, theme] = await Promise.all([getBrief(), getTheme()]);
  return Response.json({ brief, theme, folder: `events/${slug}/design` }, { headers: { "Cache-Control": "no-store" } });
});

/** Saves the brief: brief.json and brief.md in the event's design folder. The picture list is the server's; this cannot change it. */
export const PUT = eventAdminRoute("manage", async (request, { actor, slug }) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return jsonError("הבריף גדול מדי", 413);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonError("הבריף לא תקין", 400);
  }
  const body = BriefInputSchema.safeParse(json);
  if (!body.success) return jsonError("הבריף לא תקין", 422);
  const result = await updateBrief(body.data, actorLabel(actor));
  if ("error" in result) return jsonError(result.error, 422);
  await audit(actor, "design.update", { event: slug, detail: `${result.brief.deliverables.length} pieces` });
  return Response.json({ brief: result.brief });
});
