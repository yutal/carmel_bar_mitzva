import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { audit } from "@/lib/platform/audit";
import { briefToMarkdown, designTokens } from "@/lib/platform/design-brief";
import { eventAdminRoute } from "@/lib/platform/route";
import { assetFile, assetRelative, getBrief } from "@/lib/storage/design";
import { getTheme } from "@/lib/storage/theme";

/**
 * Everything a designer, a script or Claude needs to make the pieces, in one ZIP with the same layout as the design
 * folder on disk: brief.json, brief.md and assets/, plus theme.json (the live theme) and tokens.json (its resolved
 * colours, fonts and CSS variables). The markdown is rewritten here, so it always carries the current theme.
 */
export const GET = eventAdminRoute("view", async (_request, { actor, slug }) => {
  const [brief, theme] = await Promise.all([getBrief(), getTheme()]);
  const zip = new ZipArchive({ zlib: { level: 6 } });
  zip.append(JSON.stringify(brief, null, 2), { name: "brief.json" });
  zip.append(briefToMarkdown(brief, { theme, themeFile: "theme.json", assetFile: assetRelative }), { name: "brief.md" });
  zip.append(JSON.stringify(theme, null, 2), { name: "theme.json" });
  zip.append(JSON.stringify(designTokens(theme), null, 2), { name: "tokens.json" });
  for (const a of brief.assets) zip.file(assetFile(a), { name: assetRelative(a) });
  await audit(actor, "design.export", { event: slug, detail: `${brief.deliverables.length} pieces, ${brief.assets.length} pictures` });
  void zip.finalize();
  return new Response(Readable.toWeb(zip) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}_design-brief_${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
