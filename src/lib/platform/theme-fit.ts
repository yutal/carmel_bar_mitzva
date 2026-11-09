import { z } from "zod";
import {
  contrast,
  ensureContrast,
  fromHsl,
  hueDistance,
  luminance,
  mix,
  normalizeHex,
  rgbDistance,
  rgbToHex,
  toHsl,
} from "./color";
import {
  BACKDROP_IDS,
  COLOR_KEYS,
  FONT_IDS,
  PRESETS,
  SHAPE_IDS,
  ThemeSchema,
  type Backdrop,
  type ColorKey,
  type Colors,
  type FontPair,
  type Shape,
  type Theme,
} from "./theme-rules";

/**
 * Turning a picture (an invitation, a logo, a brand sheet) into an event theme, in three steps that each work
 * without the others:
 *   1. paletteFromPixels   the dominant colours of the picture, found by counting pixels (no AI, no cost)
 *   2. a proposal          the model looks at the picture and assigns the colours to roles and picks fonts and
 *                          shape; proposalFromPalette makes the same kind of proposal from step 1 alone
 *   3. fitTheme            whatever the proposal says, the result is a valid theme whose text is readable
 * Step 3 is what makes it safe to accept a model's answer: it can be wrong about taste, never about legibility.
 */

export type PaletteColor = { hex: string; share: number; saturation: number; lightness: number };

const BUCKET_BITS = 4;
const MERGE_DISTANCE = 44;

/**
 * Dominant colours of an RGB(A) pixel buffer (a thumbnail is plenty): pixels are counted in coarse buckets, then
 * buckets that are close in colour are merged, and the biggest clusters are returned with their share of the image.
 */
export function paletteFromPixels(pixels: Uint8Array, channels: 3 | 4 = 3, max = 8): PaletteColor[] {
  const size = 1 << (BUCKET_BITS * 3);
  const count = new Float64Array(size);
  const sum = [new Float64Array(size), new Float64Array(size), new Float64Array(size)];
  let total = 0;
  for (let i = 0; i + channels <= pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] < 128) continue;
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const k = ((r >> (8 - BUCKET_BITS)) << (BUCKET_BITS * 2)) | ((g >> (8 - BUCKET_BITS)) << BUCKET_BITS) | (b >> (8 - BUCKET_BITS));
    count[k]++;
    sum[0][k] += r;
    sum[1][k] += g;
    sum[2][k] += b;
    total++;
  }
  if (total === 0) return [];

  // Buckets are visited biggest first, and a cluster is represented by its biggest bucket's colour, not by an average:
  // a thin gold line next to navy leaves muddy in-between pixels, and averaging them in would turn the gold to mud.
  const buckets = [...count.keys()].filter((k) => count[k] > 0).sort((a, b) => count[b] - count[a]);
  type Cluster = { n: number; hex: string };
  const clusters: Cluster[] = [];
  for (const k of buckets) {
    const here = rgbToHex([sum[0][k] / count[k], sum[1][k] / count[k], sum[2][k] / count[k]]);
    let best = -1;
    let bestD = MERGE_DISTANCE;
    clusters.forEach((c, i) => {
      const d = rgbDistance(c.hex, here);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best >= 0) clusters[best].n += count[k];
    else clusters.push({ n: count[k], hex: here });
  }
  return clusters
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ hex: c.hex, share: c.n / total }))
    .filter((c) => c.share >= 0.003)
    .slice(0, max)
    .map((c) => {
      const [, saturation, lightness] = toHsl(c.hex);
      return { ...c, share: Number(c.share.toFixed(4)), saturation: Number(saturation.toFixed(3)), lightness: Number(lightness.toFixed(3)) };
    });
}

/** What the model returns (and what the palette fallback builds): roles for colours plus the look. fitTheme makes it safe. */
export const ThemeProposalSchema = z.object({
  mood: z.string().describe("One short Hebrew line describing the style of the source, e.g. 'כחול עמוק וזהב, אלגנטי'"),
  scheme: z.enum(["light", "dark"]),
  basedOn: z.string().describe("The id of the ready theme that is closest in feeling"),
  colors: z.object({
    canvas: z.string().describe("#rrggbb page background"),
    surface: z.string().describe("#rrggbb cards and fields"),
    ink: z.string().describe("#rrggbb main text"),
    muted: z.string().describe("#rrggbb secondary text"),
    accent: z.string().describe("#rrggbb the brand colour: buttons and links"),
    accentSoft: z.string().describe("#rrggbb lighter brand colour for borders on focus"),
    line: z.string().describe("#rrggbb hairlines"),
    tint: z.string().describe("#rrggbb subtle background for chips"),
    highlight: z.string().describe("#rrggbb second brand colour, for emphasis"),
  }),
  fonts: z.enum(FONT_IDS),
  shape: z.enum(SHAPE_IDS),
  backdrop: z.enum(BACKDROP_IDS),
  headline: z.string().describe("Up to 40 characters: the event's name as the source prints it, or an empty string"),
  notes: z.string().describe("One Hebrew sentence on why these choices match the source"),
});
export type ThemeProposal = z.infer<typeof ThemeProposalSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Fallback proposal from a palette alone
// ---------------------------------------------------------------------------------------------------------------------

/** Which ready theme is closest to a set of colours: by brand colour and background. */
export function nearestPreset(colors: Pick<Colors, "canvas" | "accent">): string {
  let best = "olive";
  let bestD = Infinity;
  for (const [id, p] of Object.entries(PRESETS)) {
    const d = rgbDistance(colors.accent, p.colors.accent) + rgbDistance(colors.canvas, p.colors.canvas);
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** How good a brand colour a palette entry is: colourful, not too dark or light, far from the background, with some presence. */
function brandScore(c: PaletteColor, background: string): number {
  const mid = 1 - Math.abs(c.lightness - 0.5) * 1.6;
  const away = Math.min(1, rgbDistance(c.hex, background) / 110);
  return c.saturation * Math.max(0.05, mid) * away * (0.45 + Math.min(1, c.share * 10));
}

/**
 * A theme proposal from the picture's colours alone: background from the biggest area, brand colour from the most
 * vivid other colour, text from the darkest (or lightest) colour. Used when no model is available and as the model's
 * grounding. Deterministic.
 */
export function proposalFromPalette(palette: PaletteColor[]): ThemeProposal {
  const base = palette[0]?.hex ?? "#f6f6ee";
  const baseL = luminance(base);
  const dark = baseL < 0.2;
  // A background that is already very light or very dark is used as it is; a mid-tone one becomes a brand colour
  // and the page gets a tint of it.
  const baseIsCanvas = baseL >= 0.6 || baseL <= 0.08;
  const canvasGuess = baseIsCanvas ? base : dark ? mix(base, "#000000", 0.7) : mix(base, "#ffffff", 0.88);

  const candidates = palette
    .filter((c, i) => (i > 0 || !baseIsCanvas) && c.saturation >= 0.18 && c.lightness > 0.1 && c.lightness < 0.92)
    .map((c) => ({ c, score: brandScore(c, canvasGuess) }))
    .filter((x) => x.score > 0.02)
    .sort((a, b) => b.score - a.score);

  const accentHex = candidates[0]?.c.hex ?? (dark ? "#e4e4e4" : "#2a2a2a");
  const [accentHue] = toHsl(accentHex);
  const second = candidates.find((x) => x.c.saturation >= 0.35 && x.c.lightness > 0.2 && x.c.lightness < 0.85 && hueDistance(toHsl(x.c.hex)[0], accentHue) >= 35)?.c.hex;
  // No second brand colour in the picture: a lighter (dark theme) or deeper (light theme) shade of the accent, which stays in the family.
  const [, accentSat, accentL] = toHsl(accentHex);
  const highlight = second ?? fromHsl([accentHue, accentSat, dark ? Math.min(0.8, accentL + 0.16) : Math.max(0.28, accentL - 0.14)]);

  const darkest = [...palette].sort((a, b) => a.lightness - b.lightness)[0];
  const lightest = [...palette].sort((a, b) => b.lightness - a.lightness)[0];
  const ink = dark
    ? lightest && lightest.lightness > 0.8
      ? lightest.hex
      : fromHsl([toHsl(canvasGuess)[0], 0.2, 0.93])
    : darkest && darkest.lightness < 0.2
      ? darkest.hex
      : fromHsl([accentHue, 0.4, 0.12]);

  const colors = {
    canvas: canvasGuess,
    surface: dark ? mix(canvasGuess, "#ffffff", 0.07) : mix(canvasGuess, "#ffffff", 0.65),
    ink,
    muted: mix(ink, canvasGuess, 0.4),
    accent: accentHex,
    accentSoft: mix(accentHex, canvasGuess, dark ? 0.28 : 0.45),
    line: mix(canvasGuess, accentHex, dark ? 0.25 : 0.18),
    tint: mix(canvasGuess, accentHex, 0.1),
    highlight,
  };
  const avgSat = palette.reduce((t, c) => t + c.saturation * c.share, 0);
  return {
    mood: dark ? "כהה ויוקרתי, לפי הצבעים בתמונה" : avgSat < 0.2 ? "בהיר ונקי, לפי הצבעים בתמונה" : "בהיר וצבעוני, לפי הצבעים בתמונה",
    scheme: dark ? "dark" : "light",
    basedOn: nearestPreset(colors),
    colors,
    fonts: avgSat < 0.2 ? "formal" : dark ? "classic" : "modern",
    shape: "soft",
    backdrop: dark ? "glow" : "plain",
    headline: "",
    notes: "הצבעים נלקחו ישירות מהצבעים הדומיננטיים בתמונה, בלי ניתוח של מודל.",
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Making any proposal safe
// ---------------------------------------------------------------------------------------------------------------------

// Backgrounds that body text can reach 7:1 on, with room to spare.
const LIGHT_CANVAS_MIN = 0.6;
const LIGHT_SURFACE_MIN = 0.55;
const DARK_CANVAS_MAX = 0.05;
const DARK_SURFACE_MAX = 0.08;

/** Mixes a colour towards white (light) or black (dark) just far enough that its luminance passes the bound. Keeps the hue as a tint. */
function pushBackground(hex: string, dark: boolean, bound: number): string {
  if (dark ? luminance(hex) <= bound : luminance(hex) >= bound) return hex;
  const target = dark ? "#000000" : "#ffffff";
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const m = (lo + hi) / 2;
    const ok = dark ? luminance(mix(hex, target, m)) <= bound : luminance(mix(hex, target, m)) >= bound;
    if (ok) hi = m;
    else lo = m;
  }
  return mix(hex, target, hi);
}

const meets = (fg: string, bgs: string[], min: number) => bgs.every((bg) => contrast(fg, bg) >= min);
function ensureAll(fg: string, bgs: string[], min: number): string {
  let out = fg;
  for (let pass = 0; pass < 2; pass++) for (const bg of bgs) out = ensureContrast(out, bg, min);
  return out;
}

const cleanHeadline = (s: string) => s.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

export type FittedTheme = { theme: Theme; adjusted: ColorKey[] };

/** What the admin screen gets back from an invitation: a theme to preview (nothing is saved yet) and how it was made. */
export type ThemeDesign = {
  theme: Theme;
  /** A few Hebrew words on the style of the picture. */
  mood: string;
  /** One sentence on why these choices. */
  notes: string;
  /** "ai": a model looked at the picture. "palette": made from the measured colours alone. */
  source: "ai" | "palette";
  /** The colours measured from the picture, biggest area first. */
  palette: string[];
  /** Colours that had to change so the text stays readable. */
  adjusted: ColorKey[];
};

/**
 * Makes a proposal into a theme that is guaranteed valid and readable, however wrong the proposal is: unparseable
 * colours are replaced by derived ones, backgrounds are pushed far enough towards light or dark, and text colours
 * are moved (keeping their hue) until they reach 7:1 for body text and 4.5:1 for secondary text and the brand colour.
 * `adjusted` lists the colours that had to change, so the admin screen can say so.
 */
export function fitTheme(proposal: ThemeProposal): FittedTheme {
  const adjusted = new Set<ColorKey>();
  const given = (k: ColorKey) => normalizeHex((proposal.colors as Partial<Record<ColorKey, unknown>>)[k]);
  const changed = (k: ColorKey, was: string | undefined, now: string) => {
    if (!was || was !== now) adjusted.add(k);
    return now;
  };

  // Light or dark: the canvas decides when it is clearly one or the other, the proposal's word otherwise.
  const rawCanvas = given("canvas");
  const lc = rawCanvas ? luminance(rawCanvas) : proposal.scheme === "dark" ? 0 : 1;
  const dark = lc < 0.12 ? true : lc > 0.45 ? false : proposal.scheme === "dark";
  const fallbackCanvas = dark ? "#101114" : "#f7f7f2";

  const canvas = changed("canvas", rawCanvas, pushBackground(rawCanvas ?? fallbackCanvas, dark, dark ? DARK_CANVAS_MAX : LIGHT_CANVAS_MIN));

  const rawSurface = given("surface");
  const surfaceBase = rawSurface ?? (dark ? mix(canvas, "#ffffff", 0.07) : mix(canvas, "#ffffff", 0.65));
  const surface = changed("surface", rawSurface, pushBackground(surfaceBase, dark, dark ? DARK_SURFACE_MAX : LIGHT_SURFACE_MIN));

  const rawAccent = given("accent");
  const accentSeed = rawAccent ?? (dark ? "#e4c76a" : "#3b5ba9");

  const rawInk = given("ink");
  const ink = changed("ink", rawInk, ensureAll(rawInk ?? (dark ? "#f4f4f4" : "#1b1b1b"), [canvas, surface], 7));

  const tintCandidates = [given("tint"), mix(canvas, accentSeed, 0.1), mix(canvas, accentSeed, 0.05), surface];
  const tint = changed("tint", given("tint"), tintCandidates.find((t): t is string => !!t && contrast(ink, t) >= 6.5 && contrast(t, canvas) >= 1.02) ?? surface);

  const text = [canvas, surface, tint];
  const muted = changed("muted", given("muted"), ensureAll(given("muted") ?? mix(ink, canvas, 0.4), text, 4.5));
  const accent = changed("accent", rawAccent, ensureAll(accentSeed, text, 4.5));
  const highlight = changed("highlight", given("highlight"), ensureAll(given("highlight") ?? mix(accent, dark ? "#ffffff" : "#000000", 0.2), [canvas], 4.5));

  const softSeed = given("accentSoft");
  const accentSoft = changed("accentSoft", softSeed, softSeed && contrast(softSeed, canvas) >= 1.3 ? softSeed : mix(accent, canvas, dark ? 0.28 : 0.45));

  const lineSeed = given("line");
  const lineOptions = [lineSeed, mix(canvas, accent, 0.22), mix(canvas, ink, 0.15)];
  const line = changed(
    "line",
    lineSeed,
    lineOptions.find((l): l is string => !!l && contrast(l, canvas) >= 1.1 && contrast(l, canvas) <= 3) ?? mix(canvas, ink, 0.15),
  );

  const colors: Colors = { canvas, surface, ink, muted, accent, accentSoft, line, tint, highlight };
  const preset = proposal.basedOn in PRESETS ? proposal.basedOn : nearestPreset(colors);
  const theme = ThemeSchema.parse({
    preset,
    colors,
    fonts: FONT_IDS.includes(proposal.fonts as FontPair) ? proposal.fonts : undefined,
    shape: SHAPE_IDS.includes(proposal.shape as Shape) ? proposal.shape : undefined,
    backdrop: BACKDROP_IDS.includes(proposal.backdrop as Backdrop) ? proposal.backdrop : undefined,
    headline: cleanHeadline(proposal.headline ?? ""),
  });
  // The loop above is built to reach these; check anyway, so a future edit cannot quietly break the promise.
  if (!meets(ink, [canvas, surface], 7) || !meets(muted, text, 4.5) || !meets(accent, text, 4.5)) {
    throw new Error("fitTheme could not reach readable contrast");
  }
  return { theme, adjusted: COLOR_KEYS.filter((k) => adjusted.has(k)) };
}

/** Swatches for the admin screen: the palette as it was read from the picture. */
export const paletteHexes = (palette: PaletteColor[]): string[] => palette.map((c) => c.hex);
