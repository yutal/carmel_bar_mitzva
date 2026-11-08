/**
 * Small colour toolbox for themes: parsing, mixing and the contrast maths that keeps text readable.
 * Pure (no server imports), so the browser preview and the tests use exactly what the server uses.
 * Every function takes and returns "#rrggbb".
 */

export type RGB = [number, number, number];
export type HSL = [number, number, number]; // hue 0-360, saturation 0-1, lightness 0-1

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** Accepts "#rgb" and "#rrggbb" (any case); anything else gives undefined. */
export function normalizeHex(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

export const hexToRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;

export const rgbToHex = ([r, g, b]: RGB): string => `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(ra.map((v, i) => v + (rb[i] - v) * t) as RGB);
}

export function toHsl(hex: string): HSL {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

export function fromHsl([h, s, l]: HSL): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

/** Distance between two hues on the colour wheel, 0 to 180. */
export const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Straight-line distance in RGB, 0 to ~441. Good enough to tell "same colour" from "different colour". */
export function rgbDistance(a: string, b: string): number {
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)];
  return Math.hypot(ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]);
}

/**
 * Moves `fg` away from `bg` (towards black or white, whichever reads better) by the least amount that reaches
 * `min` contrast, so the colour keeps its hue. Returns `fg` unchanged when it already passes.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const target = contrast("#ffffff", bg) >= contrast("#000000", bg) ? "#ffffff" : "#000000";
  if (contrast(target, bg) < min) return target; // the background itself cannot support `min`; the caller fixes the background
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(mix(fg, target, mid), bg) >= min) hi = mid;
    else lo = mid;
  }
  return mix(fg, target, hi);
}
