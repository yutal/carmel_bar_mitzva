import sharp from "sharp";
import { fitTheme, paletteFromPixels, proposalFromPalette, type FittedTheme, type PaletteColor, type ThemeDesign, type ThemeProposal } from "./theme-fit";

/**
 * A small thumbnail is plenty for finding dominant colours. It is shrunk with nearest-neighbour on purpose: averaging
 * (the normal way) turns a thin gold line on navy into a muddy olive, and the brand colour is lost; nearest keeps
 * the colours that are really in the picture.
 */
export async function measurePalette(image: Buffer): Promise<PaletteColor[]> {
  const { data } = await sharp(image, { failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(320, 320, { fit: "inside", kernel: "nearest" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return paletteFromPixels(data, 3, 8);
}

/** The model step, passed in by the route (providers.llm.themeFromImage), so this file has no server-only imports and is tested directly. */
export type Propose = (image: Buffer, palette: PaletteColor[], hint: string) => Promise<ThemeProposal>;

/**
 * The invitation-to-theme pipeline. Never saves anything; the organiser previews the result and saves it themselves.
 * `useAi` false (budget used up, no key) or a failing model still gives a theme, from the measured colours.
 */
export async function designThemeFromImage(image: Buffer, opts: { propose: Propose; hint?: string; useAi?: boolean }): Promise<ThemeDesign> {
  const palette = await measurePalette(image);
  if (palette.length === 0) throw new Error("No colours found in the picture");

  let used: ThemeProposal | undefined;
  let fitted: FittedTheme | undefined;
  if (opts.useAi !== false) {
    try {
      used = await opts.propose(image, palette, (opts.hint ?? "").slice(0, 200));
      fitted = fitTheme(used);
    } catch (err) {
      // No key, a network error or an answer that does not fit the schema: the measured colours still make a theme.
      console.error("[theme-design] model step failed, using the measured colours", err);
      used = undefined;
      fitted = undefined;
    }
  }
  const source = fitted ? "ai" : "palette";
  if (!fitted || !used) {
    used = proposalFromPalette(palette);
    fitted = fitTheme(used);
  }
  return {
    theme: fitted.theme,
    mood: String(used.mood ?? "").slice(0, 120),
    notes: String(used.notes ?? "").slice(0, 300),
    source,
    palette: palette.map((c) => c.hex),
    adjusted: fitted.adjusted,
  };
}

// Each design is a paid model call, so one event cannot run them without limit (a stuck button, a script).
const recent = new Map<string, number[]>();
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 12;

/** True when this event may run another design now; counts the call if so. */
export function takeDesignSlot(slug: string, now = Date.now()): boolean {
  const times = (recent.get(slug) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    recent.set(slug, times);
    return false;
  }
  recent.set(slug, [...times, now]);
  return true;
}
