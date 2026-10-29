import { listSubmissions } from "@/lib/storage/submissions";
import { toPublic } from "@/lib/views";

/** Finished, consented, non-hidden creations for the hall screen, newest first. Blessings without an image count once checked. */
export async function GET() {
  const items = (await listSubmissions())
    .filter((s) => s.input.consentScreen && !s.hidden)
    .filter((s) => s.files.image || s.files.cover || (s.input.experience === "blessing" && s.stages.analysis.status === "done"))
    .slice(0, 60)
    .map((s) => toPublic(s));
  return Response.json(items, { headers: { "Cache-Control": "no-store" } });
}
