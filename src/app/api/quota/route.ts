import { config } from "@/lib/config";
import { remainingFor } from "@/lib/storage/submissions";

/** How many creations a guest name has left, so the form can stop early instead of after the last step. */
export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("name") ?? "").slice(0, 60);
  const remaining = name.trim() ? await remainingFor(name) : null;
  return Response.json({ max: config.maxCreationsPerGuest || null, remaining }, { headers: { "Cache-Control": "no-store" } });
}
