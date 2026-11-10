import { ALBUM_LAYOUTS, composeAlbum, type AlbumLayout } from "@/lib/compose/album";
import { audit } from "@/lib/platform/audit";
import { assertTool, getLicense } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { getEvent } from "@/lib/storage/event";
import { listSubmissions } from "@/lib/storage/submissions";
import { getTheme } from "@/lib/storage/theme";

/**
 * The printable album as one PDF, in the event's colours. ?layout=pages|grid|blessings, ?title=…, ?cover=0,
 * ?order=oldest|newest|name. Tests and anything the check found unsuitable are left out; so is anything hidden.
 */
export const GET = eventAdminRoute("manage", async (request, { actor, slug }) => {
  await assertTool("album", { staff: true });
  const q = new URL(request.url).searchParams;
  const layout = (q.get("layout") ?? "pages") as AlbumLayout;
  if (!(layout in ALBUM_LAYOUTS)) return new Response(JSON.stringify({ error: "פריסה לא מוכרת" }), { status: 400 });
  const order = q.get("order") ?? "oldest";

  const [all, event, theme, license] = await Promise.all([listSubmissions(), getEvent(), getTheme(), getLicense()]);
  let subs = all.filter((s) => s.analysis?.isAppropriate !== false && !s.test && !s.hidden);
  // A blessings book needs the blessing; the other layouts need something to show.
  if (layout === "blessings") subs = subs.filter((s) => s.input.blessing.trim());
  subs = subs.reverse(); // listSubmissions is newest first
  if (order === "newest") subs.reverse();
  if (order === "name") subs.sort((a, b) => a.input.fullName.localeCompare(b.input.fullName, "he"));

  const pdf = await composeAlbum(subs, event, {
    layout,
    cover: q.get("cover") !== "0",
    title: q.get("title")?.slice(0, 80) || undefined,
    theme,
    open: license.mode === "open",
  });
  await audit(actor, "export.album", { event: slug, detail: `${layout} ${subs.length}` });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${slug}_album_${layout}_${stamp}.pdf"` },
  });
});
