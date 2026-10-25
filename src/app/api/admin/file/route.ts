import { jsonError, sendFile } from "@/lib/http";
import { dataPath } from "@/lib/storage/fs";

/** Any file under the data dir, by relative path (dataPath rejects traversal). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rel = params.get("path");
  if (!rel) return jsonError("חסר נתיב");
  let abs: string;
  try {
    abs = dataPath(rel);
  } catch {
    return jsonError("נתיב לא חוקי");
  }
  return sendFile(abs, { download: params.has("download") ? rel.split("/").pop() : undefined });
}
