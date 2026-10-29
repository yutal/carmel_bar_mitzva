import { jsonError } from "@/lib/http";
import { isLang, type Lang } from "@/lib/i18n";
import { readUpload, UploadError } from "@/lib/images";
import { ALL_STYLES, getQaRun, startQaRun } from "@/lib/qa/check";
import type { ImageStyle } from "@/lib/types";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  return Response.json({ run: (await getQaRun(id)) ?? null }, { headers: { "Cache-Control": "no-store" } });
}

/** Multipart: styles and langs (comma separated), single and group (photos for the guest cases). Starts a paid run. */
export async function POST(request: Request) {
  const form = await request.formData();
  const list = (k: string) => String(form.get(k) ?? "").split(",").filter(Boolean);
  const styles = list("styles").filter((s): s is ImageStyle => (ALL_STYLES as string[]).includes(s));
  const langs = list("langs").filter((l): l is Lang => isLang(l));
  if (!styles.length || !langs.length) return jsonError("בחר לפחות סגנון אחד ושפה אחת");
  try {
    const single = await readUpload(form.get("single") as File | null);
    const group = await readUpload(form.get("group") as File | null);
    return Response.json({ run: await startQaRun({ styles, langs, photos: { single, group } }) }, { status: 202 });
  } catch (err) {
    if (err instanceof UploadError) return jsonError(err.message, 422);
    throw err;
  }
}
