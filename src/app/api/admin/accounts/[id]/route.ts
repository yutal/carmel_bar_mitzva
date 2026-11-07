import { z } from "zod";
import { jsonError } from "@/lib/http";
import { EventsSchema, mutateAccounts, toView } from "@/lib/platform/accounts";
import { audit } from "@/lib/platform/audit";
import { hashPassword, randomPassword } from "@/lib/platform/password";
import { ownerRoute } from "@/lib/platform/route";

const Body = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  events: EventsSchema.optional(),
  disabled: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
});

/** Changes an operator. Any change to access, a reset or a disable ends their open sessions at once. */
export const PATCH = ownerRoute(async (request, { actor, params }) => {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה", 422);
  const password = body.data.resetPassword ? randomPassword() : undefined;
  const hash = password ? await hashPassword(password) : undefined;
  const updated = await mutateAccounts((all) => {
    const a = all.find((x) => x.id === params.id);
    if (!a) return undefined;
    if (body.data.name !== undefined) a.name = body.data.name;
    if (body.data.events !== undefined) a.events = body.data.events;
    if (body.data.disabled !== undefined) a.disabled = body.data.disabled;
    if (hash) a.passwordHash = hash;
    if (body.data.events !== undefined || body.data.disabled !== undefined || hash) a.sessionVersion++;
    return toView(a);
  });
  if (!updated) return jsonError("לא נמצא", 404);
  await audit(actor, "account.update", { detail: `${updated.username} ${Object.keys(body.data).join(",")}` });
  return Response.json({ account: updated, ...(password && { password }) });
});

export const DELETE = ownerRoute(async (_request, { actor, params }) => {
  const removed = await mutateAccounts((all) => {
    const i = all.findIndex((x) => x.id === params.id);
    return i === -1 ? undefined : all.splice(i, 1)[0];
  });
  if (!removed) return jsonError("לא נמצא", 404);
  await audit(actor, "account.delete", { detail: removed.username });
  return Response.json({ ok: true });
});
