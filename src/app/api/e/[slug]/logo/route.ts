import { jsonError, sendFile } from "@/lib/http";
import { publicEventRoute } from "@/lib/platform/route";
import { getTheme, logoPath } from "@/lib/storage/theme";

export const GET = publicEventRoute(async () => ((await getTheme()).hasLogo ? sendFile(logoPath()) : jsonError("לא נמצא", 404)), { entry: "none" });
