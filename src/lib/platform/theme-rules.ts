import { z } from "zod";

/** Only #rrggbb: a colour value ends up inside a style attribute, so nothing else may get through. */
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const FONT_PAIRS = {
  classic: { label: "קלאסי (Heebo + Frank Ruhl)", sans: "--font-heebo", display: "--font-frank" },
  modern: { label: "מודרני (Rubik)", sans: "--font-rubik", display: "--font-rubik" },
  bold: { label: "בולט (Suez One)", sans: "--font-heebo", display: "--font-suez" },
  soft: { label: "רך (Varela Round)", sans: "--font-varela", display: "--font-varela" },
} as const;
export type FontPair = keyof typeof FONT_PAIRS;

/** The colours a theme sets. Everything else in the guest UI is derived from these. */
export const COLOR_KEYS = ["canvas", "surface", "ink", "muted", "accent", "accentSoft", "line", "tint", "highlight"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type Colors = Record<ColorKey, string>;

/** Which CSS variable (declared in globals.css @theme) each colour drives. */
const VAR: Record<ColorKey, string> = {
  canvas: "--color-canvas",
  surface: "--color-surface",
  ink: "--color-ink",
  muted: "--color-muted",
  accent: "--color-accent",
  accentSoft: "--color-accent-soft",
  line: "--color-line",
  tint: "--color-olive-100",
  highlight: "--color-clay",
};

export const PRESETS: Record<string, { label: string; fonts: FontPair; colors: Colors }> = {
  olive: {
    label: "זית (ברירת מחדל)",
    fonts: "classic",
    colors: { canvas: "#f6f6ee", surface: "#ffffff", ink: "#2d331c", muted: "#6b7350", accent: "#5e6a3a", accentSoft: "#9aa46a", line: "#dce0bf", tint: "#eceedc", highlight: "#d9875e" },
  },
  gold: {
    label: "זהב ושחור",
    fonts: "classic",
    colors: { canvas: "#14120f", surface: "#201c16", ink: "#f4ead2", muted: "#b9a97f", accent: "#d4af37", accentSoft: "#a58a2c", line: "#3a3325", tint: "#2b2519", highlight: "#e8c766" },
  },
  sport: {
    label: "ספורט",
    fonts: "bold",
    colors: { canvas: "#f3f6fb", surface: "#ffffff", ink: "#0e2238", muted: "#51647a", accent: "#e8590c", accentSoft: "#f08a4b", line: "#d5deea", tint: "#e4ecf6", highlight: "#1c7ed6" },
  },
  pastel: {
    label: "פסטל",
    fonts: "soft",
    colors: { canvas: "#fdf6f8", surface: "#ffffff", ink: "#4a3340", muted: "#8b6f7d", accent: "#c0648a", accentSoft: "#e3a1bd", line: "#f0d9e2", tint: "#f9e8ef", highlight: "#7fb7a4" },
  },
  sky: {
    label: "תכלת ולבן",
    fonts: "modern",
    colors: { canvas: "#f4fafe", surface: "#ffffff", ink: "#12304a", muted: "#587a94", accent: "#1f78b4", accentSoft: "#7ab6dc", line: "#d3e6f3", tint: "#e3f1fa", highlight: "#f2a541" },
  },
  neon: {
    label: "ניאון",
    fonts: "modern",
    colors: { canvas: "#0b0b1a", surface: "#16162d", ink: "#f2f2ff", muted: "#a2a2cf", accent: "#00e5c3", accentSoft: "#6a5cff", line: "#2c2c52", tint: "#1d1d3b", highlight: "#ff3d9a" },
  },
};
export const DEFAULT_PRESET = "olive";

export const ThemeSchema = z.object({
  preset: z.string().refine((p) => p in PRESETS).default(DEFAULT_PRESET),
  /** Per-colour overrides on top of the preset. Needs a licence with customTheme. */
  colors: z.partialRecord(z.enum(COLOR_KEYS), HexColor).default({}),
  fonts: z.enum(Object.keys(FONT_PAIRS) as [FontPair, ...FontPair[]]).optional(),
  hasLogo: z.boolean().default(false),
  /** Overrides the big headline on the guest welcome screen. */
  headline: z.string().trim().max(40).default(""),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME: Theme = ThemeSchema.parse({});

/** What the guest pages of an event get: CSS variables for its wrapper element. Nothing outside the wrapper is touched. */
export function themeVars(theme: Theme): Record<string, string> {
  const preset = PRESETS[theme.preset] ?? PRESETS[DEFAULT_PRESET];
  const colors: Colors = { ...preset.colors, ...theme.colors } as Colors;
  const fonts = FONT_PAIRS[theme.fonts ?? preset.fonts];
  const vars: Record<string, string> = {
    "--color-inverse": colors.ink,
    "--font-sans": `var(${fonts.sans}), system-ui, sans-serif`,
    "--font-display": `var(${fonts.display}), var(${fonts.sans}), serif`,
  };
  for (const k of COLOR_KEYS) vars[VAR[k]] = colors[k];
  return vars;
}

/** Contrast ratio of two #rrggbb colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
