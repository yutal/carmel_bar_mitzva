import { jsonError } from "@/lib/http";
import { audit } from "@/lib/platform/audit";
import { getLicense, licenseUsage, saveLicense } from "@/lib/platform/license";
import { LicenseSchema } from "@/lib/platform/license-rules";
import { eventAdminRoute } from "@/lib/platform/route";

/** Everyone in the event sees what the licence allows; only the owner sees the private note. */
export const GET = eventAdminRoute("view", async (_request, { actor }) => {
  const [license, usage] = await Promise.all([getLicense(), licenseUsage()]);
  const view = actor.kind === "owner" ? license : { ...license, note: "" };
  return Response.json({ license: view, usage: { creations: usage.creations, ...(actor.kind === "owner" && { spentUsd: usage.spentUsd }) } }, { headers: { "Cache-Control": "no-store" } });
});

export const PUT = eventAdminRoute("owner", async (request, { actor, slug }) => {
  const body = LicenseSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("רישיון לא תקין", 422);
  if (body.data.startsAt && body.data.endsAt && Date.parse(body.data.endsAt) <= Date.parse(body.data.startsAt)) {
    return jsonError("סוף החלון חייב להיות אחרי ההתחלה", 422);
  }
  const before = await getLicense();
  const license = await saveLicense(body.data);
  const changed = (Object.keys(license) as (keyof typeof license)[]).filter((k) => k !== "issuedAt" && JSON.stringify(license[k]) !== JSON.stringify(before[k]));
  await audit(actor, "license.update", { event: slug, detail: changed.join(",") });
  return Response.json({ license });
});
