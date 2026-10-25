import { listSubmissions } from "@/lib/storage/submissions";
import { toPublic } from "@/lib/views";

/** Finished, consented, non-hidden creations for the hall screen, newest first. */
export async function GET() {
  const items = (await listSubmissions())
    .filter((s) => s.input.consentScreen && !s.hidden && (s.files.image || s.files.cover))
    .slice(0, 60)
    .map(toPublic);
  return Response.json(items, { headers: { "Cache-Control": "no-store" } });
}
