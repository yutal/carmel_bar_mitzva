import { getLicense } from "@/lib/platform/license";
import { publicEventRoute } from "@/lib/platform/route";
import { listSubmissions } from "@/lib/storage/submissions";
import { showsOnScreen, toPublic } from "@/lib/views";

/** Finished, consented, non-hidden creations for the hall screen, newest first. Blessings without an image count once checked. */
export const GET = publicEventRoute(async () => {
  // The hall screen is a licensed tool. Without it, or with the event suspended or tampered with, the screen shows nothing.
  const license = await getLicense();
  if (license.tampered || license.suspended || !license.tools.includes("screen")) return Response.json([], { headers: { "Cache-Control": "no-store" } });
  const items = (await listSubmissions())
    .filter(showsOnScreen)
    .filter((s) => s.files.image || s.files.cover || (s.input.experience === "blessing" && s.stages.analysis.status === "done"))
    .slice(0, 60)
    .map((s) => toPublic(s));
  return Response.json(items, { headers: { "Cache-Control": "no-store" } });
});
