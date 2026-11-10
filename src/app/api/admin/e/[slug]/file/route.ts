import { jsonError, sendFile } from "@/lib/http";
import { eventAdminRoute } from "@/lib/platform/route";
import { dataPath } from "@/lib/storage/fs";

/** Files that never leave the server, even to someone allowed into the event. */
const PRIVATE = new Set(["license.json"]);

/** Any file of this event by relative path. dataPath keeps it inside the event's directory. */
export const GET = eventAdminRoute("view", async (request) => {
  const params = new URL(request.url).searchParams;
  const rel = params.get("path");
  if (!rel) return jsonError("חסר נתיב");
  let abs: string;
  try {
    abs = dataPath(rel);
  } catch {
    return jsonError("נתיב לא חוקי");
  }
  if (PRIVATE.has(rel.replace(/^\.?\/+/, ""))) return jsonError("לא נמצא", 404);
  return sendFile(abs, {
    download: params.has("download") ? rel.split("/").pop() : undefined,
    range: request.headers.get("range"),
  });
});
