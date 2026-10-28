import "server-only";
import os from "node:os";
import heicConvert from "heic-convert";
import PQueue from "p-queue";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Keep memory flat when many guests upload at once: no libvips cache, one thread
// per image, and at most one photo per CPU (minimum two) decoded at the same time.
sharp.cache(false);
sharp.concurrency(1);
const photoQueue = new PQueue({ concurrency: Math.max(2, os.availableParallelism()) });

/**
 * Re-encodes an uploaded photo: applies EXIF rotation, caps the size and
 * drops all metadata (sharp strips EXIF/GPS unless asked to keep it).
 */
export async function normalizePhoto(input: Buffer, maxSide = 1536): Promise<Buffer> {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer();
}

export async function readUpload(file: File | null): Promise<Buffer | undefined> {
  if (!file || file.size === 0) return undefined;
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("הקובץ גדול מדי");
  const isHeic = /\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type);
  if (!file.type.startsWith("image/") && !isHeic) throw new UploadError("אפשר להעלות רק תמונה");
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    return await photoQueue.add(async () => {
      // sharp's prebuilt libheif cannot decode iPhone HEIC (HEVC), so convert it first.
      const data = isHeic ? Buffer.from(await heicConvert({ buffer: raw, format: "JPEG", quality: 0.92 })) : raw;
      return normalizePhoto(data);
    });
  } catch {
    throw new UploadError("לא הצלחנו לקרוא את התמונה");
  }
}

export class UploadError extends Error {}
