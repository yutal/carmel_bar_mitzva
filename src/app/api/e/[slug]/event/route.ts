import { config } from "@/lib/config";
import { getLicense, licenseUsage } from "@/lib/platform/license";
import { BLOCK_MESSAGES, licenseBlock } from "@/lib/platform/license-rules";
import { publicEventRoute } from "@/lib/platform/route";
import { getEvent } from "@/lib/storage/event";
import { getTheme } from "@/lib/storage/theme";

/** Public event info for the guest and screen pages, and whether the event is open right now. */
export const GET = publicEventRoute(async () => {
  const [{ celebrantName, celebrantNameEn, eventTitle, eventDate, songsEnabled }, license, usage, theme] = await Promise.all([
    getEvent(),
    getLicense(),
    licenseUsage(),
    getTheme(),
  ]);
  const block = licenseBlock(license, "blessings", usage, Date.now(), { creating: true });
  // maxCreations is null when MAX_CREATIONS_PER_GUEST is 0, and the guest page then does not mention a limit.
  const maxCreations = config.maxCreationsPerGuest || null;
  return Response.json(
    {
      celebrantName,
      celebrantNameEn,
      eventTitle,
      eventDate,
      songsEnabled,
      maxCreations,
      mode: license.mode,
      hasLogo: theme.hasLogo,
      headline: theme.headline,
      closed: block && block !== "quota" && block !== "budget" ? { block, ...BLOCK_MESSAGES[block] } : null,
      /** Creations are used up but blessings alone still work. */
      blessingOnly: block === "quota" || block === "budget",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}, { entry: "guest" });
