import { jsonError, sendFile } from "@/lib/http";
import { actorLabel, audit } from "@/lib/platform/audit";
import { isAssetId } from "@/lib/platform/design-brief";
import { eventAdminRoute } from "@/lib/platform/route";
import { assetFile, getBrief, removeAsset } from "@/lib/storage/design";

const idOf = (params: Record<string, string | string[] | undefined>) => (typeof params.id === "string" ? params.id : "");

/** Only pictures listed in the brief are served, by an id of a fixed shape, so no path from outside ever reaches the disk. */
export const GET = eventAdminRoute("view", async (_request, { params }) => {
  const id = idOf(params);
  const asset = isAssetId(id) ? (await getBrief()).assets.find((a) => a.id === id) : undefined;
  return asset ? sendFile(assetFile(asset)) : jsonError("לא נמצא", 404);
});

export const DELETE = eventAdminRoute("manage", async (_request, { actor, slug, params }) => {
  const id = idOf(params);
  const brief = isAssetId(id) ? await removeAsset(id, actorLabel(actor)) : undefined;
  if (!brief) return jsonError("לא נמצא", 404);
  await audit(actor, "design.asset.remove", { event: slug, detail: id });
  return Response.json({ brief });
});
