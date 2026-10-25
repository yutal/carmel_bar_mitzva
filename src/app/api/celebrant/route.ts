import { getEvent } from "@/lib/storage/event";

/** Public event info for the guest and screen pages. */
export async function GET() {
  const { celebrantName, eventTitle, eventDate } = await getEvent();
  return Response.json({ celebrantName, eventTitle, eventDate }, { headers: { "Cache-Control": "no-store" } });
}
