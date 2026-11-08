import { keyUrl, mintKey, originOf } from "@/lib/platform/gate";
import { ROLLING_MINUTES, ROLLING_REFRESH_MINUTES } from "@/lib/platform/gate-rules";
import { getGate } from "@/lib/platform/gate";
import { publicEventRoute } from "@/lib/platform/route";

/**
 * The address the hall screen draws as its QR code. With the gate on it carries a short-lived key, renewed every
 * few minutes by the screen, so a photo of the QR stops working soon after. Only the hall screen (or signed-in
 * staff) can ask; with the gate off the plain address is returned.
 */
export const GET = publicEventRoute(async (request, { slug }) => {
  const origin = originOf(request);
  const gate = await getGate();
  const headers = { "Cache-Control": "no-store" };
  if (!gate.required) return Response.json({ url: `${origin}/e/${slug}`, refreshMinutes: null }, { headers });
  const { token, exp } = await mintKey("guest", ROLLING_MINUTES / 60);
  return Response.json({ url: keyUrl(origin, slug, token, "guest"), expiresAt: new Date(exp).toISOString(), refreshMinutes: ROLLING_REFRESH_MINUTES }, { headers });
}, { entry: "screen" });
