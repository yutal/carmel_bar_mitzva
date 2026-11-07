import { z } from "zod";
import { jsonError } from "@/lib/http";
import { assertTool } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { PRINT_STATUSES, removePrintItem, updatePrintItem } from "@/lib/print/queue";

const Body = z.object({ status: z.enum(PRINT_STATUSES).optional(), copies: z.number().int().min(1).max(20).optional() });

export const PATCH = eventAdminRoute("moderate", async (request, { params }) => {
  await assertTool("print", { staff: true });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה", 422);
  const item = await updatePrintItem(String(params.id), body.data);
  return item ? Response.json({ item }) : jsonError("לא נמצא", 404);
});

export const DELETE = eventAdminRoute("moderate", async (_request, { params }) => {
  await assertTool("print", { staff: true });
  return (await removePrintItem(String(params.id))) ? Response.json({ ok: true }) : jsonError("לא נמצא", 404);
});
