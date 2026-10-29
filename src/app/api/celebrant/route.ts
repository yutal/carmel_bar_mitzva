import { config } from "@/lib/config";
import { getEvent } from "@/lib/storage/event";

/** Public event info for the guest and screen pages. */
export async function GET() {
  const { celebrantName, eventTitle, eventDate, songsEnabled } = await getEvent();
  // maxCreations is null when MAX_CREATIONS_PER_GUEST is 0, and the guest page then does not mention a limit.
  const maxCreations = config.maxCreationsPerGuest || null;
  return Response.json({ celebrantName, eventTitle, eventDate, songsEnabled, maxCreations }, { headers: { "Cache-Control": "no-store" } });
}
