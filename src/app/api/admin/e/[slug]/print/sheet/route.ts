import { jsonError } from "@/lib/http";
import { assertTool } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { isProfileId, PRINT_PROFILES } from "@/lib/print/profiles";
import { listPrintItems, printFileFor } from "@/lib/print/queue";
import { composeSheets } from "@/lib/print/render";

/** ?profile=…: one PDF of A4 sheets with every queued item of that size (all their copies) and crop marks. */
export const GET = eventAdminRoute("moderate", async (request, { slug }) => {
  await assertTool("print", { staff: true });
  const profile = new URL(request.url).searchParams.get("profile");
  if (!isProfileId(profile)) return jsonError("חסר גודל הדפסה", 422);
  const items = (await listPrintItems()).filter((i) => i.profile === profile && i.status === "queued");
  if (!items.length) return jsonError("אין בתור פריטים בגודל הזה", 404);
  const files = [];
  for (const item of items) files.push({ jpeg: await printFileFor(item), copies: item.copies });
  const pdf = await composeSheets(files, PRINT_PROFILES[profile]);
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${slug}_${profile}_sheets.pdf"`, "Cache-Control": "private, no-store" },
  });
});
