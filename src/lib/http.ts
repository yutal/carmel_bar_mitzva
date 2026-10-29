import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

/** `range` is the request's Range header: Safari will not play video or audio without byte ranges. */
export async function sendFile(absPath: string, opts: { download?: string; range?: string | null } = {}): Promise<Response> {
  try {
    const data = await fs.readFile(absPath);
    const headers = new Headers({
      "Content-Type": TYPES[path.extname(absPath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
      "Accept-Ranges": "bytes",
    });
    if (opts.download) headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}`);
    const m = opts.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (m && (m[1] || m[2])) {
      const size = data.length;
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers });
    }
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return jsonError("לא נמצא", 404);
  }
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
