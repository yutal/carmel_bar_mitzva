import { composeAlbum } from "@/lib/compose/album";
import { audit } from "@/lib/platform/audit";
import { eventAdminRoute } from "@/lib/platform/route";
import { getEvent } from "@/lib/storage/event";
import { listSubmissions } from "@/lib/storage/submissions";

/** The printable album as one PDF: every guest in the order they wrote, minus tests and anything the check found unsuitable. */
export const GET = eventAdminRoute("manage", async (_request, { actor, slug }) => {
  const subs = (await listSubmissions()).filter((s) => s.analysis?.isAppropriate !== false && !s.test).reverse();
  const pdf = await composeAlbum(subs, await getEvent());
  await audit(actor, "export.album", { event: slug });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${slug}_album_${stamp}.pdf"` },
  });
});
