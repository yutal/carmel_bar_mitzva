import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { DIRS, dataPath } from "@/lib/storage/fs";

/** Streams the whole memory collection as a ZIP (guest uploads excluded unless ?uploads=1). */
export async function GET(request: Request) {
  const withUploads = new URL(request.url).searchParams.get("uploads") === "1";
  const zip = new ZipArchive({ zlib: { level: 6 } });
  for (const dir of [DIRS.blessings, DIRS.images, DIRS.songs, DIRS.celebrant, ...(withUploads ? [DIRS.uploads] : [])]) {
    zip.directory(dataPath(dir), dir, (entry) => (entry.name.endsWith(".tmp") ? false : entry));
  }
  void zip.finalize();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(zip) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="carmel_memories_${stamp}.zip"`,
    },
  });
}
