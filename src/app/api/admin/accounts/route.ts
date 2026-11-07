import { z } from "zod";
import { config } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { EventsSchema, findByUsername, listAccounts, mutateAccounts, newAccountId, toView, type Account } from "@/lib/platform/accounts";
import { audit } from "@/lib/platform/audit";
import { hashPassword, randomPassword } from "@/lib/platform/password";
import { ownerRoute } from "@/lib/platform/route";

export const GET = ownerRoute(async () =>
  Response.json({ accounts: (await listAccounts()).map(toView) }, { headers: { "Cache-Control": "no-store" } }),
);

const Body = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/),
  name: z.string().trim().min(1).max(60),
  events: EventsSchema.default({}),
});

/** Creates an operator with a random password, shown once in the answer. */
export const POST = ownerRoute(async (request, { actor }) => {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("שם משתמש: 3-40 תווים, אותיות לטיניות קטנות, ספרות, נקודה, קו תחתון או מקף", 422);
  if (body.data.username === config.ownerUsername.toLowerCase() || (await findByUsername(body.data.username))) {
    return jsonError("שם המשתמש תפוס", 409);
  }
  const password = randomPassword();
  const account: Account = {
    id: newAccountId(),
    username: body.data.username,
    name: body.data.name,
    passwordHash: await hashPassword(password),
    events: body.data.events,
    disabled: false,
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
  };
  await mutateAccounts((all) => {
    all.push(account);
  });
  await audit(actor, "account.create", { detail: `${account.username} ${JSON.stringify(account.events)}` });
  return Response.json({ account: toView(account), password }, { status: 201 });
});
