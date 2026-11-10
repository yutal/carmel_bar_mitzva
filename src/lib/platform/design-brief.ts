import { z } from "zod";
import { PRINT_PROFILES, printGeometry } from "../print/profiles";
import { BACKDROPS, COLOR_KEYS, FONT_PAIRS, PRESETS, SHAPES, resolveColors, themeWrapperStyle, type Theme } from "./theme-rules";

/**
 * The design brief: what the organiser wants the event to look like, in one structured file on disk
 * (DATA_DIR/events/<slug>/design/brief.json, with a readable brief.md beside it and the uploaded pictures in assets/).
 * The app only captures and stores it. Anything that makes designs from it (Claude with Figma and Canva, a script, a
 * designer) reads the same files, so the app never needs an integration with those tools.
 */

export const KINDS = {
  ui: { label: "מסכי האפליקציה", size: "phone_screen" },
  magnet: { label: "מסגרת למגנט", size: "magnet_5x7" },
  sticker_pack: { label: "סטיקרים", size: "sticker_square" },
  poster_frame: { label: "מסגרת לפוסטר", size: "poster" },
  sign: { label: "שלט", size: "a5_sign" },
  invitation: { label: "הזמנה או כרטיס", size: "postcard" },
  other: { label: "אחר", size: "square" },
} as const;
export type Kind = keyof typeof KINDS;
export const KIND_IDS = Object.keys(KINDS) as [Kind, ...Kind[]];

export type SizeSpec = {
  label: string;
  /** Pixels of the whole file, bleed included for print pieces. */
  widthPx: number;
  heightPx: number;
  /** Print pieces only: the finished size, the bleed on every side and the resolution. */
  print?: { widthMm: number; heightMm: number; bleedMm: number; dpi: number; trimPx: { w: number; h: number } };
};

const printSize = (label: string, widthMm: number, heightMm: number, bleedMm: number, dpi = 300): SizeSpec => {
  const g = printGeometry({ label, widthMm, heightMm, bleedMm, dpi });
  return { label, widthPx: g.fullW, heightPx: g.fullH, print: { widthMm, heightMm, bleedMm, dpi, trimPx: { w: g.trimW, h: g.trimH } } };
};

/** Sizes a piece can have. Magnet and card sizes come straight from the print profiles, so the brief and the print queue agree. */
export const SIZES: Record<string, SizeSpec> = {
  ...Object.fromEntries(Object.entries(PRINT_PROFILES).map(([id, p]) => [id, printSize(p.label, p.widthMm, p.heightMm, p.bleedMm, p.dpi)])),
  a5_sign: printSize("שלט A5 (14.8×21 ס״מ)", 148, 210, 3),
  a4_sign: printSize("שלט A4 (21×29.7 ס״מ)", 210, 297, 3),
  sticker_square: { label: "סטיקר מרובע 512×512", widthPx: 512, heightPx: 512 },
  phone_screen: { label: "מסך טלפון 390×844", widthPx: 390, heightPx: 844 },
  hall_screen: { label: "מסך אולם 1920×1080", widthPx: 1920, heightPx: 1080 },
  poster: { label: "פוסטר 1024×1536", widthPx: 1024, heightPx: 1536 },
  square: { label: "מרובע 1080×1080", widthPx: 1080, heightPx: 1080 },
};
export const SIZE_IDS = Object.keys(SIZES) as [string, ...string[]];

/** Width over height of the finished piece (without bleed), for drawing the frame. */
export function aspectOf(sizeId: string): number {
  const s = SIZES[sizeId] ?? SIZES.square;
  return s.print ? s.print.trimPx.w / s.print.trimPx.h : s.widthPx / s.heightPx;
}

/** What can be placed on a piece. Placement is the centre of the item, as a fraction of the finished piece. */
export const ELEMENTS = {
  title: { label: "כותרת", text: true, at: { x: 0.5, y: 0.14, size: "l" } },
  date: { label: "תאריך", text: true, at: { x: 0.5, y: 0.25, size: "s" } },
  venue: { label: "מקום", text: true, at: { x: 0.5, y: 0.31, size: "s" } },
  guestName: { label: "שם האורח", text: true, at: { x: 0.5, y: 0.9, size: "m" } },
  logo: { label: "לוגו", text: false, at: { x: 0.5, y: 0.07, size: "s" } },
  qr: { label: "קוד QR", text: false, at: { x: 0.85, y: 0.88, size: "s" } },
} as const;
export type ElementId = keyof typeof ELEMENTS;
export const ELEMENT_IDS = Object.keys(ELEMENTS) as [ElementId, ...ElementId[]];

const Frac = z.number().min(0).max(1);
export const PlacementSchema = z.object({
  x: Frac,
  y: Frac,
  size: z.enum(["s", "m", "l"]).default("m"),
  align: z.enum(["start", "center", "end"]).default("center"),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const ASSET_ROLES = {
  invitation: "הזמנה",
  logo: "לוגו",
  reference: "השראה",
  sample: "דוגמה קיימת",
} as const;
export type AssetRole = keyof typeof ASSET_ROLES;

const ASSET_ID = /^a[0-9a-f]{8}$/;
export const isAssetId = (v: unknown): v is string => typeof v === "string" && ASSET_ID.test(v);
const DELIVERABLE_ID = /^d[0-9a-f]{8}$/;

/** A picture the organiser uploaded. The list is owned by the server: the brief a client saves cannot add or remove entries. */
export const AssetSchema = z.object({
  id: z.string().regex(ASSET_ID),
  role: z.enum(Object.keys(ASSET_ROLES) as [AssetRole, ...AssetRole[]]),
  name: z.string().max(80),
  ext: z.enum(["png", "jpg"]),
  addedAt: z.string(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const MAX_ASSETS = 40;
export const MAX_DELIVERABLES = 30;

export const DeliverableSchema = z.object({
  id: z.string().regex(DELIVERABLE_ID),
  kind: z.enum(KIND_IDS),
  name: z.string().trim().min(1).max(80),
  /** The organiser's own words: what it should feel like, what is on it, who it is for. */
  notes: z.string().trim().max(2000).default(""),
  size: z.enum(SIZE_IDS),
  elements: z.partialRecord(z.enum(ELEMENT_IDS), PlacementSchema).default({}),
  /** Assets that show what they mean (inspiration, an existing piece to match). */
  references: z.array(z.string().regex(ASSET_ID)).max(10).default([]),
});
export type Deliverable = z.infer<typeof DeliverableSchema>;

/** What a client sends when it saves. */
export const BriefInputSchema = z.object({
  event: z.object({
    /** As it should be printed. */
    title: z.string().trim().max(80).default(""),
    dateText: z.string().trim().max(60).default(""),
    venueText: z.string().trim().max(80).default(""),
    language: z.enum(["he", "en"]).default("he"),
  }),
  branding: z.object({
    tone: z.string().trim().max(500).default(""),
    likes: z.string().trim().max(500).default(""),
    avoid: z.string().trim().max(500).default(""),
  }),
  deliverables: z.array(DeliverableSchema).max(MAX_DELIVERABLES).default([]),
});
export type BriefInput = z.infer<typeof BriefInputSchema>;

export const BriefSchema = BriefInputSchema.extend({
  version: z.literal(1).default(1),
  assets: z.array(AssetSchema).max(MAX_ASSETS).default([]),
  updatedAt: z.string().default(""),
  updatedBy: z.string().default(""),
});
export type Brief = z.infer<typeof BriefSchema>;

export const emptyBrief = (): Brief => BriefSchema.parse({ event: {}, branding: {} });

/** New deliverable of a kind, with the elements that usually belong on it already placed. */
export function newDeliverable(kind: Kind, id: string): Deliverable {
  const at = (...ids: ElementId[]) => Object.fromEntries(ids.map((e) => [e, PlacementSchema.parse(ELEMENTS[e].at)])) as Deliverable["elements"];
  const elements: Record<Kind, Deliverable["elements"]> = {
    ui: at("title", "logo"),
    magnet: at("title", "date"),
    sticker_pack: at("guestName"),
    poster_frame: at("title", "guestName"),
    sign: at("title", "date", "venue", "qr"),
    invitation: at("title", "date", "venue", "logo"),
    other: {},
  };
  return DeliverableSchema.parse({ id, kind, name: KINDS[kind].label, size: KINDS[kind].size, elements: elements[kind] });
}

/**
 * The brief to store after a client saved `input`: the server's asset list stays as it was, references to assets that no
 * longer exist are dropped, and the audit fields are set. Returns an error string when the input cannot be stored.
 */
export function applyBriefInput(current: Brief, input: BriefInput, by: string, now: Date): { brief: Brief } | { error: string } {
  const ids = input.deliverables.map((d) => d.id);
  if (new Set(ids).size !== ids.length) return { error: "מזהה כפול בין הפריטים" };
  const known = new Set(current.assets.map((a) => a.id));
  const deliverables = input.deliverables.map((d) => ({ ...d, references: [...new Set(d.references)].filter((r) => known.has(r)) }));
  return { brief: { ...current, ...input, deliverables, version: 1, updatedAt: now.toISOString(), updatedBy: by } };
}

// ---------------------------------------------------------------------------------------------------------------------
// The readable version
// ---------------------------------------------------------------------------------------------------------------------

const SIZE_WORD = { s: "small", m: "medium", l: "large" } as const;
/** How big each size is: text height as a share of the piece's height, pictures (logo, QR) as a share of its width. */
export const SIZE_SHARE = { text: { s: 4, m: 7, l: 11 }, picture: { s: 15, m: 25, l: 40 } } as const;

/** "top centre", "bottom right": where the centre of an item sits, in plain words (left and right as seen, not start and end). */
export function placeWords(p: Pick<Placement, "x" | "y">): string {
  const h = p.x < 0.34 ? "left" : p.x > 0.66 ? "right" : "centre";
  const v = p.y < 0.34 ? "top" : p.y > 0.66 ? "bottom" : "middle";
  return v === "middle" && h === "centre" ? "centre" : `${v} ${h}`;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Colours, fonts, shape and the CSS variables of a theme, for whoever builds with it. */
export function designTokens(theme: Theme) {
  const preset = PRESETS[theme.preset] ?? PRESETS.olive;
  const fonts = FONT_PAIRS[theme.fonts ?? preset.fonts];
  const shape = SHAPES[theme.shape ?? preset.shape];
  const backdrop = BACKDROPS[theme.backdrop ?? preset.backdrop];
  const cssVariables: Record<string, string> = {};
  for (const [name, value] of Object.entries(themeWrapperStyle(theme))) {
    if (name.startsWith("--") && typeof value === "string") cssVariables[name] = value;
  }
  return {
    preset: theme.preset,
    presetLabel: preset.label,
    colors: resolveColors(theme),
    fonts: { id: theme.fonts ?? preset.fonts, label: fonts.label },
    shape: { id: theme.shape ?? preset.shape, label: shape.label },
    backdrop: { id: theme.backdrop ?? preset.backdrop, label: backdrop.label },
    headline: theme.headline,
    hasLogo: theme.hasLogo,
    cssVariables,
  };
}

export type MarkdownContext = {
  theme: Theme;
  /** Where the theme file is, relative to brief.md. */
  themeFile: string;
  /** Where an asset is, relative to brief.md. */
  assetFile: (a: Asset) => string;
};

/** The brief as a document anyone (or any model) can follow without reading JSON. Rewritten on every save. */
export function briefToMarkdown(brief: Brief, ctx: MarkdownContext): string {
  const t = designTokens(ctx.theme);
  const L: string[] = [];
  const title = oneLine(brief.event.title) || "(no title yet)";
  L.push(`# Design brief: ${title}`, "");
  if (brief.updatedAt) L.push(`Updated ${brief.updatedAt}${brief.updatedBy ? ` by ${brief.updatedBy}` : ""}. The structured version is brief.json; this file says the same in words.`, "");

  L.push("## Event", "");
  L.push(`- Title, exactly as it should be printed: ${oneLine(brief.event.title) || "(none)"}`);
  L.push(`- Date, exactly as it should be printed: ${oneLine(brief.event.dateText) || "(none)"}`);
  L.push(`- Venue: ${oneLine(brief.event.venueText) || "(none)"}`);
  L.push(`- Language: ${brief.event.language === "he" ? "Hebrew, right to left (check every text for correct direction and shaping)" : "English, left to right"}`, "");

  L.push("## Look", "");
  L.push(`- Theme: ${t.presetLabel} (${t.preset}). The live theme is ${ctx.themeFile}; the colours below were true when this file was written.`);
  L.push(`- Colours: ${COLOR_KEYS.map((k) => `${k} ${t.colors[k]}`).join(", ")}`);
  L.push(`- Fonts: ${t.fonts.label}. Corners: ${t.shape.label}. Background: ${t.backdrop.label}.`);
  if (brief.branding.tone) L.push(`- Tone: ${oneLine(brief.branding.tone)}`);
  if (brief.branding.likes) L.push(`- Likes: ${oneLine(brief.branding.likes)}`);
  if (brief.branding.avoid) L.push(`- Avoid: ${oneLine(brief.branding.avoid)}`);
  L.push("");

  const byId = new Map(brief.assets.map((a) => [a.id, a]));
  if (brief.assets.length) {
    L.push("## Pictures", "");
    for (const a of brief.assets) L.push(`- ${ctx.assetFile(a)}: ${ASSET_ROLES[a.role]}${a.name ? `, "${oneLine(a.name)}"` : ""}`);
    L.push("");
  }

  L.push("## Pieces to make", "");
  if (brief.deliverables.length === 0) L.push("Nothing yet.", "");
  brief.deliverables.forEach((d, i) => {
    const s = SIZES[d.size] ?? SIZES.square;
    L.push(`### ${i + 1}. ${oneLine(d.name)} (${KINDS[d.kind].label})`, "");
    L.push(`- Size: ${s.label}. File: ${s.widthPx}×${s.heightPx} px${s.print ? ` (finished piece ${s.print.widthMm}×${s.print.heightMm} mm = ${s.print.trimPx.w}×${s.print.trimPx.h} px at ${s.print.dpi} dpi, plus ${s.print.bleedMm} mm bleed on every side)` : ""}.`);
    if (d.notes) L.push(`- In the organiser's words: ${oneLine(d.notes)}`);
    const placed = ELEMENT_IDS.filter((e) => d.elements[e]);
    if (placed.length) {
      L.push(`- Layout. Positions are the centre of each item, measured from the top-left corner of the finished piece (not the bleed); 0% is the left or top edge, 100% the right or bottom edge. Text height is a share of the piece's height, logo and QR width a share of its width.`);
      for (const e of placed) {
        const p = d.elements[e]!;
        const el = ELEMENTS[e];
        const text = oneLine(e === "title" ? brief.event.title : e === "date" ? brief.event.dateText : e === "venue" ? brief.event.venueText : "");
        const share = SIZE_SHARE[el.text ? "text" : "picture"][p.size];
        const what = el.text ? `text height about ${share}%` : `width about ${share}%`;
        const align = el.text ? `, aligned to the ${p.align === "center" ? "centre" : p.align === "start" ? (brief.event.language === "he" ? "right edge" : "left edge") : brief.event.language === "he" ? "left edge" : "right edge"} of the box` : "";
        L.push(`  - ${el.label} (${e}): ${placeWords(p)}, centre at ${pct(p.x)} across and ${pct(p.y)} down, ${SIZE_WORD[p.size]} (${what})${align}${text ? `; text: "${text}"` : el.text && e !== "guestName" ? "; text not set yet" : e === "guestName" ? "; filled in per guest" : ""}.`);
      }
    }
    const refs = d.references.map((r) => byId.get(r)).filter((a): a is Asset => Boolean(a));
    if (refs.length) L.push(`- Look at: ${refs.map((a) => ctx.assetFile(a)).join(", ")}`);
    L.push("");
  });
  return L.join("\n");
}
