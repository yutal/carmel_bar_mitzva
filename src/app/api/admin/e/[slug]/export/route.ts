import path from "node:path";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { audit } from "@/lib/platform/audit";
import { eventAdminRoute } from "@/lib/platform/route";
import { DIRS, dataPath } from "@/lib/storage/fs";
import { filePath, listSubmissions } from "@/lib/storage/submissions";

/**
 * Streams the event's memory collection as a ZIP (guest uploads excluded unless ?uploads=1).
 * ?marketing=1 exports only the finished images, with their blessing text, of guests who opted in to marketing use.
 */
export const GET = eventAdminRoute("manage", async (request, { actor, slug }) => {
  const params = new URL(request.url).searchParams;
  const marketing = params.get("marketing") === "1";
  const withUploads = params.get("uploads") === "1";
  const zip = new ZipArchive({ zlib: { level: 6 } });
  if (marketing) {
    for (const s of await listSubmissions()) {
      if (!s.input.consentMarketing || s.hidden || s.test || !s.files.image) continue;
      zip.file(filePath(s.files.image), { name: path.basename(s.files.image) });
      zip.file(dataPath(DIRS.blessings, `${s.id}.txt`), { name: `${s.id}.txt` });
    }
  } else {
    // The JSON records hold the prompts and analysis; only the owner's backup includes them.
    const full = actor.kind === "owner";
    for (const dir of [DIRS.blessings, DIRS.images, DIRS.songs, DIRS.celebrant, ...(withUploads ? [DIRS.uploads] : [])]) {
      zip.directory(dataPath(dir), dir, (entry) => (entry.name.endsWith(".tmp") || (!full && entry.name.endsWith(".json")) ? false : entry));
    }
  }
  await audit(actor, marketing ? "export.marketing" : withUploads ? "export.zip+uploads" : "export.zip", { event: slug });
  void zip.finalize();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(zip) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}_${marketing ? "marketing" : "memories"}_${stamp}.zip"`,
    },
  });
});
