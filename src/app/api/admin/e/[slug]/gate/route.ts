import { z } from "zod";
import { jsonError } from "@/lib/http";
import { audit } from "@/lib/platform/audit";
import { getGate, keyUrl, mintKey, originOf, saveGate } from "@/lib/platform/gate";
import { MAX_KEY_HOURS, ROLLING_MINUTES, SCREEN_KEY_HOURS } from "@/lib/platform/gate-rules";
import { getLicense } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";

const NO_STORE = { "Cache-Control": "no-store" };

/** The gate's state and the licence window it follows. Keys themselves are never listed; they are minted on request. */
export const GET = eventAdminRoute("view", async () => {
  const [gate, license] = await Promise.all([getGate(), getLicense()]);
  return Response.json(
    { gate, window: { startsAt: license.startsAt, endsAt: license.endsAt }, limits: { maxKeyHours: MAX_KEY_HOURS, rollingMinutes: ROLLING_MINUTES, screenKeyHours: SCREEN_KEY_HOURS } },
    { headers: NO_STORE },
  );
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mint"), kind: z.enum(["guest", "screen"]), hours: z.number().min(0.25).max(MAX_KEY_HOURS).optional() }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("rotate") }),
  z.object({ action: z.literal("require"), required: z.boolean() }),
]);

export const POST = eventAdminRoute("manage", async (request, { actor, slug }) => {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה", 422);
  const gate = await getGate();
  switch (body.data.action) {
    case "mint": {
      const kind = body.data.kind;
      const { token, nbf, exp } = await mintKey(kind, body.data.hours ?? (kind === "screen" ? SCREEN_KEY_HOURS : MAX_KEY_HOURS));
      await audit(actor, kind === "screen" ? "gate.mint_screen" : "gate.mint_key", { event: slug, detail: `until ${new Date(exp).toISOString()}` });
      return Response.json({ url: keyUrl(originOf(request), slug, token, kind), notBefore: new Date(nbf).toISOString(), expiresAt: new Date(exp).toISOString() }, { headers: NO_STORE });
    }
    case "close":
    case "open": {
      const closed = body.data.action === "close";
      await audit(actor, closed ? "gate.close" : "gate.open", { event: slug });
      return Response.json({ gate: await saveGate({ ...gate, closed }) }, { headers: NO_STORE });
    }
    case "rotate": {
      await audit(actor, "gate.rotate", { event: slug, detail: `generation ${gate.gen + 1}` });
      return Response.json({ gate: await saveGate({ ...gate, gen: gate.gen + 1 }) }, { headers: NO_STORE });
    }
    case "require": {
      // Turning the gate off exposes the guest address to anyone who has it, so it stays with the platform owner.
      if (actor.kind !== "owner") return jsonError("רק בעל הפלטפורמה יכול לבטל את הדרישה לקוד QR", 403);
      await audit(actor, body.data.required ? "gate.require" : "gate.unrequire", { event: slug });
      return Response.json({ gate: await saveGate({ ...gate, required: body.data.required }) }, { headers: NO_STORE });
    }
  }
});
