import { jsonError } from "@/lib/http";
import { assertTool } from "@/lib/platform/license";
import { eventAdminRoute } from "@/lib/platform/route";
import { getPrintItem, printFileFor } from "@/lib/print/queue";

/** The finished print file (300 dpi, with bleed) of one queue item. */
export const GET = eventAdminRoute("moderate", async (_request, { params, slug }) => {
  await assertTool("print", { staff: true });
  const item = await getPrintItem(String(params.id));
  if (!item) return jsonError("לא נמצא", 404);
  const jpeg = await printFileFor(item);
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${slug}_${String(item.serial).padStart(4, "0")}_${item.profile}.jpg"`,
      "Cache-Control": "private, no-store",
    },
  });
});
