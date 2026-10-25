import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export async function sendFile(absPath: string, opts: { download?: string } = {}): Promise<Response> {
  try {
    const data = await fs.readFile(absPath);
    const headers = new Headers({
      "Content-Type": TYPES[path.extname(absPath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    });
    if (opts.download) headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}`);
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return jsonError("לא נמצא", 404);
  }
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
