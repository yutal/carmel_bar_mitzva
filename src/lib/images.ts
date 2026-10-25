import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Re-encodes an uploaded photo: applies EXIF rotation, caps the size and
 * drops all metadata (sharp strips EXIF/GPS unless asked to keep it).
 */
export async function normalizePhoto(input: Buffer, maxSide = 1536): Promise<Buffer> {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

export async function readUpload(file: File | null): Promise<Buffer | undefined> {
  if (!file || file.size === 0) return undefined;
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("הקובץ גדול מדי");
  if (!file.type.startsWith("image/")) throw new UploadError("אפשר להעלות רק תמונה");
  try {
    return await normalizePhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    throw new UploadError("לא הצלחנו לקרוא את התמונה");
  }
}

export class UploadError extends Error {}
