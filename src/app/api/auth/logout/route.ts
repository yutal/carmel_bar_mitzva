import { sessionCookie } from "@/lib/platform/session";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie("", 0) },
  });
}
