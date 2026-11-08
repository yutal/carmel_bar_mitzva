import { z } from "zod";
import { contrast, luminance } from "./color";

export { contrast };

/** Only #rrggbb: a colour value ends up inside a style attribute, so nothing else may get through. */
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Font pairs an event can wear. Each is a CSS variable loaded once in the root layout, so only the events that pick one download it. */
export const FONT_PAIRS = {
  classic: { label: "קלאסי (Heebo + Frank Ruhl)", sans: "--font-heebo", display: "--font-frank" },
  modern: { label: "מודרני (Rubik)", sans: "--font-rubik", display: "--font-rubik" },
  bold: { label: "בולט (Suez One)", sans: "--font-heebo", display: "--font-suez" },
  soft: { label: "רך (Varela Round)", sans: "--font-varela", display: "--font-varela" },
  formal: { label: "רשמי, כמו הזמנה (David Libre)", sans: "--font-heebo", display: "--font-david" },
  playful: { label: "שובב (Secular One)", sans: "--font-varela", display: "--font-secular" },
} as const;
export type FontPair = keyof typeof FONT_PAIRS;
export const FONT_IDS = Object.keys(FONT_PAIRS) as [FontPair, ...FontPair[]];

/**
 * Corner style. Drives the Tailwind radius variables and the button radius on the event's wrapper, so cards,
 * fields and buttons change together.
 */
export const SHAPES = {
  soft: { label: "רך", radius: { xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem" }, button: "9999px" },
  round: { label: "עגול מאוד", radius: { xl: "1.25rem", "2xl": "1.75rem", "3xl": "2.5rem" }, button: "9999px" },
  sharp: { label: "חד", radius: { xl: "0.125rem", "2xl": "0.25rem", "3xl": "0.375rem" }, button: "0.375rem" },
} as const;
export type Shape = keyof typeof SHAPES;
export const SHAPE_IDS = Object.keys(SHAPES) as [Shape, ...Shape[]];

/** A quiet pattern behind the guest pages, drawn from the theme's own colours. */
export const BACKDROPS = {
  plain: { label: "חלק" },
  glow: { label: "הילה" },
  dots: { label: "נקודות" },
  stripes: { label: "פסים" },
  confetti: { label: "קונפטי" },
} as const;
export type Backdrop = keyof typeof BACKDROPS;
export const BACKDROP_IDS = Object.keys(BACKDROPS) as [Backdrop, ...Backdrop[]];

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

export type Preset = {
  label: string;
  /** One line for the gallery: what kind of event it suits. */
  hint: string;
  fonts: FontPair;
  shape: Shape;
  backdrop: Backdrop;
  colors: Colors;
};

/**
 * The ready themes. Every one keeps body text at 7:1 against its backgrounds and its accent at 4.5:1 against the
 * canvas (theme-rules.test.ts checks all of them), so a theme is never a readability risk.
 */
export const PRESETS: Record<string, Preset> = {
  olive: {
    label: "זית (ברירת מחדל)",
    hint: "טבעי ונקי, מתאים לכל אירוע",
    fonts: "classic",
    shape: "soft",
    backdrop: "plain",
    colors: { canvas: "#f6f6ee", surface: "#ffffff", ink: "#2d331c", muted: "#636a48", accent: "#5e6a3a", accentSoft: "#9aa46a", line: "#dce0bf", tint: "#eceedc", highlight: "#d9875e" },
  },
  gold: {
    label: "זהב ושחור",
    hint: "יוקרתי וערבי, לאירוע חגיגי",
    fonts: "classic",
    shape: "soft",
    backdrop: "glow",
    colors: { canvas: "#14120f", surface: "#201c16", ink: "#f4ead2", muted: "#b9a97f", accent: "#d4af37", accentSoft: "#a58a2c", line: "#3a3325", tint: "#2b2519", highlight: "#e8c766" },
  },
  royal: {
    label: "כחול מלכותי",
    hint: "רשמי ומכובד, כמו הזמנה מודפסת",
    fonts: "formal",
    shape: "soft",
    backdrop: "plain",
    colors: { canvas: "#f6f2e7", surface: "#ffffff", ink: "#0f1f3d", muted: "#4f5b78", accent: "#1b3a6b", accentSoft: "#7392c4", line: "#d9d3c0", tint: "#ebe6d6", highlight: "#96701a" },
  },
  garden: {
    label: "גן פורח",
    hint: "רענן ועדין, אביב ואירועי בוקר",
    fonts: "soft",
    shape: "round",
    backdrop: "plain",
    colors: { canvas: "#f3f8f1", surface: "#ffffff", ink: "#223629", muted: "#506d58", accent: "#397650", accentSoft: "#9cc7a8", line: "#d6e6d8", tint: "#e5f1e6", highlight: "#c4506c" },
  },
  sunset: {
    label: "שקיעה",
    hint: "חם וצבעוני, אירוע בחוץ או מסיבת ערב",
    fonts: "modern",
    shape: "round",
    backdrop: "glow",
    colors: { canvas: "#fff5ec", surface: "#ffffff", ink: "#3b1d17", muted: "#8a5a4b", accent: "#b63a08", accentSoft: "#f59f6b", line: "#f6d8c3", tint: "#fde7d6", highlight: "#be185d" },
  },
  ocean: {
    label: "ים",
    hint: "רענן ובהיר, חוף ובריכה",
    fonts: "modern",
    shape: "soft",
    backdrop: "plain",
    colors: { canvas: "#eefafa", surface: "#ffffff", ink: "#08323a", muted: "#41727c", accent: "#0b6e80", accentSoft: "#66c2d1", line: "#c4e6ea", tint: "#daf2f4", highlight: "#d4500a" },
  },
  sky: {
    label: "תכלת ולבן",
    hint: "נקי ושמיימי, קל לקריאה",
    fonts: "modern",
    shape: "soft",
    backdrop: "plain",
    colors: { canvas: "#f4fafe", surface: "#ffffff", ink: "#12304a", muted: "#4d6f89", accent: "#1c6fa8", accentSoft: "#7ab6dc", line: "#d3e6f3", tint: "#e3f1fa", highlight: "#c26a0e" },
  },
  pastel: {
    label: "פסטל",
    hint: "מתוק ורך, בת מצווה וימי הולדת",
    fonts: "soft",
    shape: "round",
    backdrop: "dots",
    colors: { canvas: "#fdf6f8", surface: "#ffffff", ink: "#4a3340", muted: "#7a5d6b", accent: "#a64871", accentSoft: "#e3a1bd", line: "#f0d9e2", tint: "#f9e8ef", highlight: "#4f9d86" },
  },
  sport: {
    label: "ספורט",
    hint: "אנרגטי, לחוגגים שחיים לכדורסל או לכדורגל",
    fonts: "bold",
    shape: "soft",
    backdrop: "plain",
    colors: { canvas: "#f3f6fb", surface: "#ffffff", ink: "#0e2238", muted: "#51647a", accent: "#b23d05", accentSoft: "#f08a4b", line: "#d5deea", tint: "#e4ecf6", highlight: "#1c7ed6" },
  },
  arena: {
    label: "זירה",
    hint: "כהה וחד, אולם ספורט בערב משחק",
    fonts: "bold",
    shape: "sharp",
    backdrop: "stripes",
    colors: { canvas: "#14161b", surface: "#1f2229", ink: "#f4f5f7", muted: "#aab0bb", accent: "#ff7a1a", accentSoft: "#c25a0e", line: "#343944", tint: "#252932", highlight: "#ffd43b" },
  },
  midnight: {
    label: "חצות",
    hint: "כחול כהה וכוכבים, אירוע לילה",
    fonts: "classic",
    shape: "soft",
    backdrop: "glow",
    colors: { canvas: "#0e1124", surface: "#171b36", ink: "#eceffd", muted: "#a3abd6", accent: "#8c9eff", accentSoft: "#5c6bc0", line: "#2a2f5e", tint: "#1e2345", highlight: "#ffd166" },
  },
  neon: {
    label: "ניאון",
    hint: "מסיבת נוער, צבעים זוהרים על רקע כהה",
    fonts: "modern",
    shape: "round",
    backdrop: "glow",
    colors: { canvas: "#0b0b1a", surface: "#16162d", ink: "#f2f2ff", muted: "#a2a2cf", accent: "#00e5c3", accentSoft: "#6a5cff", line: "#2c2c52", tint: "#1d1d3b", highlight: "#ff3d9a" },
  },
  retro: {
    label: "רטרו",
    hint: "קרם ואדום, אווירת שנות ה-70",
    fonts: "bold",
    shape: "sharp",
    backdrop: "dots",
    colors: { canvas: "#f8efdc", surface: "#fffaf0", ink: "#3a2418", muted: "#755e4a", accent: "#a8281f", accentSoft: "#d9807a", line: "#e6d5b5", tint: "#f1e4c8", highlight: "#1f7a76" },
  },
  mono: {
    label: "שחור לבן",
    hint: "מינימלי ועריכתי, כמו מגזין",
    fonts: "formal",
    shape: "sharp",
    backdrop: "plain",
    colors: { canvas: "#ffffff", surface: "#f7f7f7", ink: "#111111", muted: "#555555", accent: "#111111", accentSoft: "#8a8a8a", line: "#e2e2e2", tint: "#f0f0f0", highlight: "#d6291f" },
  },
  party: {
    label: "מסיבה",
    hint: "קונפטי וסגול, חגיגה שמחה",
    fonts: "playful",
    shape: "round",
    backdrop: "confetti",
    colors: { canvas: "#fffbf1", surface: "#ffffff", ink: "#2b1b3d", muted: "#6c5a84", accent: "#6741d9", accentSoft: "#b197fc", line: "#e5dbff", tint: "#f3edff", highlight: "#e03131" },
  },
};
export const DEFAULT_PRESET = "olive";

export const ThemeSchema = z.object({
  preset: z.string().refine((p) => p in PRESETS).default(DEFAULT_PRESET),
  /** Per-colour overrides on top of the preset. Needs a licence with customTheme. */
  colors: z.partialRecord(z.enum(COLOR_KEYS), HexColor).default({}),
  fonts: z.enum(FONT_IDS).optional(),
  /** Corner style and background pattern; left out, the preset's own are used. */
  shape: z.enum(SHAPE_IDS).optional(),
  backdrop: z.enum(BACKDROP_IDS).optional(),
  hasLogo: z.boolean().default(false),
  /** Overrides the big headline on the guest welcome screen. */
  headline: z.string().trim().max(40).default(""),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME: Theme = ThemeSchema.parse({});

/** True when the theme changes anything beyond picking a ready preset, which a licence without customTheme does not allow. */
export const isCustom = (t: Theme): boolean => Object.keys(t.colors).length > 0 || t.fonts !== undefined || t.shape !== undefined || t.backdrop !== undefined || t.headline !== "";

/** The nine colours a theme resolves to: the preset's, with the theme's overrides on top. */
export function resolveColors(theme: Theme): Colors {
  const preset = PRESETS[theme.preset] ?? PRESETS[DEFAULT_PRESET];
  return { ...preset.colors, ...theme.colors } as Colors;
}

/** What the guest pages of an event get: CSS variables for its wrapper element. Nothing outside the wrapper is touched. */
export function themeVars(theme: Theme): Record<string, string> {
  const preset = PRESETS[theme.preset] ?? PRESETS[DEFAULT_PRESET];
  const colors = resolveColors(theme);
  const fonts = FONT_PAIRS[theme.fonts ?? preset.fonts];
  const shape = SHAPES[theme.shape ?? preset.shape];
  const vars: Record<string, string> = {
    "--color-inverse": colors.ink,
    "--font-sans": `var(${fonts.sans}), system-ui, sans-serif`,
    "--font-display": `var(${fonts.display}), var(${fonts.sans}), serif`,
    "--radius-xl": shape.radius.xl,
    "--radius-2xl": shape.radius["2xl"],
    "--radius-3xl": shape.radius["3xl"],
    "--btn-radius": shape.button,
  };
  for (const k of COLOR_KEYS) vars[VAR[k]] = colors[k];
  return vars;
}

const mixVar = (name: string, pct: number) => `color-mix(in srgb, var(${name}) ${pct}%, transparent)`;

/** The pattern layers for a backdrop, built from the theme's CSS variables. */
function backdropLayers(b: Backdrop): { image: string; size?: string } {
  switch (b) {
    case "glow":
      return {
        image: [
          `radial-gradient(70rem 34rem at 85% -8rem, ${mixVar("--color-accent-soft", 32)}, transparent)`,
          `radial-gradient(48rem 28rem at 0% 100%, ${mixVar("--color-clay", 16)}, transparent)`,
        ].join(", "),
      };
    case "dots":
      return { image: `radial-gradient(${mixVar("--color-accent", 16)} 1.5px, transparent 1.6px)`, size: "22px 22px" };
    case "stripes":
      return { image: `repeating-linear-gradient(135deg, ${mixVar("--color-accent", 8)} 0 14px, transparent 14px 28px)` };
    case "confetti":
      return {
        image: [
          `radial-gradient(circle at 12% 18%, ${mixVar("--color-accent", 22)} 0 5px, transparent 6px)`,
          `radial-gradient(circle at 70% 34%, ${mixVar("--color-clay", 24)} 0 4px, transparent 5px)`,
          `radial-gradient(circle at 38% 72%, ${mixVar("--color-accent-soft", 32)} 0 6px, transparent 7px)`,
          `radial-gradient(circle at 88% 84%, ${mixVar("--color-accent", 16)} 0 3px, transparent 4px)`,
        ].join(", "),
        size: "180px 180px",
      };
    default:
      return { image: "" };
  }
}

/**
 * The whole inline style of an event's guest wrapper: variables, background colour and pattern. One function so the
 * guest pages, the result page and the admin preview can never drift apart.
 */
export function themeWrapperStyle(theme: Theme): Record<string, string> {
  const preset = PRESETS[theme.preset] ?? PRESETS[DEFAULT_PRESET];
  const layers = backdropLayers(theme.backdrop ?? preset.backdrop);
  return {
    ...themeVars(theme),
    backgroundColor: "var(--color-canvas)",
    ...(layers.image ? { backgroundImage: layers.image } : {}),
    ...(layers.size ? { backgroundSize: layers.size } : {}),
    color: "var(--color-ink)",
    minHeight: "100dvh",
  };
}

/** Light or dark, from the canvas. For the gallery filter. */
export const isDark = (colors: Colors): boolean => luminance(colors.canvas) < 0.2;
