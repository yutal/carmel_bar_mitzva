import { z } from "zod";
import { LIVE_TOOLS, TOOL_IDS, TOOLS, type ToolId } from "./tools";

/** "celebrant": guests appear with the celebrant from the reference photos. "open": no celebrant, the guest is the star. */
export const EVENT_MODES = ["celebrant", "open"] as const;
export type EventMode = (typeof EVENT_MODES)[number];

/**
 * What the platform owner sold for one event. Only the owner can change it, and it is stored signed, so a licence
 * edited anywhere but through the owner's screen stops working instead of granting more.
 */
export const LicenseSchema = z.object({
  tools: z.array(z.enum(TOOL_IDS)).default([]),
  mode: z.enum(EVENT_MODES).default("celebrant"),
  /** ISO times; null leaves that side open. Guests can create only inside the window. */
  startsAt: z.string().datetime({ offset: true }).nullable().default(null),
  endsAt: z.string().datetime({ offset: true }).nullable().default(null),
  /** Creations (image or song) guests may make in total; 0 = no limit. Tests and blessings alone do not count. */
  maxCreations: z.number().int().min(0).max(100_000).default(0),
  /** Estimated AI spend allowed for the event in USD, regenerations and tests included; 0 = no limit. */
  budgetUsd: z.number().min(0).max(100_000).default(0),
  /** Whether the organiser may change colours, fonts and logo, or only pick a ready theme. */
  customTheme: z.boolean().default(false),
  suspended: z.boolean().default(false),
  /** Free text for the owner: customer, price, invoice. Not shown to operators. */
  note: z.string().max(500).default(""),
  issuedAt: z.string().default(""),
});
export type License = z.infer<typeof LicenseSchema>;

/** What an event gets when its licence is missing or fails its signature: nothing. */
export const LOCKED_LICENSE: License = LicenseSchema.parse({ suspended: true });

/** A full licence for the first event, so an existing installation keeps working after the upgrade. */
export function unlimitedLicense(mode: EventMode = "celebrant"): License {
  return LicenseSchema.parse({ tools: [...LIVE_TOOLS], mode, customTheme: true, issuedAt: new Date().toISOString() });
}

export type LicenseBlock = "tampered" | "suspended" | "not_started" | "ended" | "tool_off" | "quota" | "budget";

export type LicenseUsage = { creations: number; spentUsd: number };

/** Why guests cannot use this tool right now, or null when they can. Pure, so it is tested directly. */
export function licenseBlock(
  lic: License & { tampered?: boolean },
  tool: ToolId,
  usage: LicenseUsage,
  now = Date.now(),
  opts: { creating?: boolean; staff?: boolean } = {},
): LicenseBlock | null {
  if (lic.tampered) return "tampered";
  if (lic.suspended) return "suspended";
  // The window is for guests. The organiser's tools (album, print, regenerate) keep working after the event ends.
  if (!opts.staff && lic.startsAt && now < Date.parse(lic.startsAt)) return "not_started";
  if (!opts.staff && lic.endsAt && now > Date.parse(lic.endsAt)) return "ended";
  if (!lic.tools.includes(tool) || TOOLS[tool].status !== "live") return "tool_off";
  if (lic.budgetUsd > 0 && usage.spentUsd >= lic.budgetUsd) return "budget";
  if (opts.creating && lic.maxCreations > 0 && usage.creations >= lic.maxCreations) return "quota";
  return null;
}

/** What the guest reads when the event is closed to them. */
export const BLOCK_MESSAGES: Record<LicenseBlock, { he: string; en: string }> = {
  tampered: { he: "העמדה לא זמינה כרגע", en: "This station is not available right now" },
  suspended: { he: "העמדה לא זמינה כרגע", en: "This station is not available right now" },
  not_started: { he: "האירוע עוד לא נפתח. נתראה בקרוב!", en: "The event has not opened yet. See you soon!" },
  ended: { he: "האירוע הסתיים. תודה שבאתם!", en: "The event has ended. Thank you for coming!" },
  tool_off: { he: "הכלי הזה לא פעיל באירוע", en: "This tool is not active at this event" },
  quota: { he: "כל היצירות של האירוע נוצלו. אפשר עדיין לכתוב ברכה!", en: "All creations for this event are used up. You can still write a blessing!" },
  budget: { he: "כל היצירות של האירוע נוצלו. אפשר עדיין לכתוב ברכה!", en: "All creations for this event are used up. You can still write a blessing!" },
};

/** The organiser's wording, for the admin screens. */
export const BLOCK_ADMIN: Record<LicenseBlock, string> = {
  tampered: "הרישיון לא עבר אימות חתימה ולכן נחסם",
  suspended: "הרישיון מושהה",
  not_started: "חלון האירוע עוד לא התחיל",
  ended: "חלון האירוע הסתיים",
  tool_off: "הכלי לא כלול ברישיון",
  quota: "מכסת היצירות נוצלה",
  budget: "תקציב ה-AI של האירוע נוצל",
};

/** A canonical string of the licence for signing: fixed key order, so the same licence always signs the same. */
export function canonical(lic: License): string {
  const keys = Object.keys(LicenseSchema.shape).sort() as (keyof License)[];
  return JSON.stringify(keys.map((k) => [k, lic[k]]));
}
