import "server-only";
import { config } from "@/lib/config";
import { listSubmissions, removeFile, updateSubmission } from "./submissions";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes guests' original photos once they are older than the retention period.
 * Posters made from them are kept; only the source photo goes.
 */
export async function purgeExpiredGuestPhotos(now = Date.now()): Promise<number> {
  if (config.guestPhotoRetentionDays <= 0) return 0;
  const cutoff = now - config.guestPhotoRetentionDays * DAY_MS;
  let removed = 0;
  for (const s of await listSubmissions()) {
    if (!s.files.photo || Date.parse(s.createdAt) > cutoff) continue;
    await removeFile(s.files.photo);
    await updateSubmission(s.id, (x) => {
      delete x.files.photo;
    });
    removed++;
  }
  return removed;
}

/** Runs the purge now and then hourly for the life of the process. */
export function scheduleGuestPhotoPurge(): void {
  const run = () =>
    purgeExpiredGuestPhotos()
      .then((n) => n && console.log(`[retention] removed ${n} guest photo(s)`))
      .catch((err) => console.error("[retention] purge failed", err));
  void run();
  setInterval(run, 60 * 60 * 1000).unref();
}
