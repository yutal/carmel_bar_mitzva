import { z } from "zod";
import { jsonError } from "@/lib/http";
import { assertTool } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { addPrintItem, listPrintItems } from "@/lib/print/queue";
import { isProfileId, PRINT_PROFILES } from "@/lib/print/profiles";
import { listSubmissions } from "@/lib/storage/submissions";

/** The queue, the sizes on offer and the posters that can be added. */
export const GET = eventAdminRoute("moderate", async () => {
  await assertTool("print", { staff: true });
  const [items, subs] = await Promise.all([listPrintItems(), listSubmissions()]);
  const eligible = subs.filter((s) => s.files.image && !s.test && !s.hidden).map((s) => ({ id: s.id, name: s.input.fullName, number: s.number ?? null }));
  return Response.json(
    { profiles: Object.fromEntries(Object.entries(PRINT_PROFILES).map(([id, p]) => [id, p.label])), items, eligible },
    { headers: { "Cache-Control": "no-store" } },
  );
});

const Body = z.object({ submissionIds: z.array(z.string().max(120)).min(1).max(100), profile: z.string(), copies: z.number().int().min(1).max(20).default(1) });

export const POST = eventAdminRoute("moderate", async (request) => {
  await assertTool("print", { staff: true });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !isProfileId(body.data.profile)) return jsonError("בקשה לא תקינה", 422);
  const added = [];
  for (const id of body.data.submissionIds) {
    try {
      added.push(await addPrintItem(id, body.data.profile, body.data.copies));
    } catch {
      // A creation without a finished poster is skipped; the rest still go in.
    }
  }
  return Response.json({ added }, { status: 201 });
});
