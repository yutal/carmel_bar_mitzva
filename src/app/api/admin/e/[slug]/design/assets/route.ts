import { jsonError } from "@/lib/http";
import { readUpload, UploadError } from "@/lib/images";
import { actorLabel, audit } from "@/lib/platform/audit";
import { ASSET_ROLES, type AssetRole } from "@/lib/platform/design-brief";
import { eventAdminRoute } from "@/lib/platform/route";
import { addAsset } from "@/lib/storage/design";

const cleanName = (s: string) => s.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

/** One picture for the brief: an invitation, a logo, something to take inspiration from, an existing piece. Kept as PNG when it has transparency. */
export const POST = eventAdminRoute("manage", async (request, { actor, slug }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("בקשה לא תקינה", 400);
  const role = String(form.get("role") ?? "reference");
  if (!(role in ASSET_ROLES)) return jsonError("סוג תמונה לא מוכר", 422);
  const file = form.get("file") as File | null;
  let image: Buffer | undefined;
  try {
    image = await readUpload(file, { keepAlpha: true, maxSide: 2000 });
  } catch (err) {
    return jsonError(err instanceof UploadError ? err.message : "הקובץ אינו תמונה תקינה", 422);
  }
  if (!image) return jsonError("לא נבחרה תמונה");
  const label = cleanName(String(form.get("name") ?? "")) || cleanName((file?.name ?? "").replace(/\.[^.]+$/, ""));
  const result = await addAsset(image, role as AssetRole, label, actorLabel(actor));
  if ("error" in result) return jsonError(result.error, 422);
  await audit(actor, "design.asset.add", { event: slug, detail: `${result.asset.id} ${role}` });
  return Response.json({ asset: result.asset, brief: result.brief }, { status: 201 });
});
