/**
 * Print profiles: one record per size/machine. Adding a size is a line here. Sizes are the trimmed (finished) size;
 * the file also carries a bleed on every side so the cutter never leaves a white edge.
 */
export type PrintProfile = {
  label: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  bleedMm: number;
};

export const PRINT_PROFILES = {
  magnet_5x7: { label: "מגנט 5×7.5 ס״מ", widthMm: 50, heightMm: 75, dpi: 300, bleedMm: 2 },
  magnet_2x3in: { label: "מגנט 2×3 אינץ׳", widthMm: 50.8, heightMm: 76.2, dpi: 300, bleedMm: 2 },
  postcard: { label: "גלויה / מגנט גדול 10×15 ס״מ", widthMm: 100, heightMm: 150, dpi: 300, bleedMm: 3 },
  card: { label: "קלף אספנות 8.5×12 ס״מ", widthMm: 85, heightMm: 120, dpi: 300, bleedMm: 3 },
} as const satisfies Record<string, PrintProfile>;
export type PrintProfileId = keyof typeof PRINT_PROFILES;
export const isProfileId = (v: unknown): v is PrintProfileId => typeof v === "string" && v in PRINT_PROFILES;

const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

/** Pixel sizes of the finished piece and of the file with bleed. */
export function printGeometry(p: PrintProfile) {
  const trimW = mmToPx(p.widthMm, p.dpi);
  const trimH = mmToPx(p.heightMm, p.dpi);
  const bleed = mmToPx(p.bleedMm, p.dpi);
  return { trimW, trimH, bleed, fullW: trimW + 2 * bleed, fullH: trimH + 2 * bleed };
}

/** Posters differing from the target shape by at most this much are cropped to it; more than that and the whole poster is kept. */
export const MAX_CROP_ASPECT_DIFF = 0.03;

/**
 * "cover": fill the page, losing a sliver at the edges (the posters are 2:3, like most magnets, so this is the usual case).
 * "contain": keep every pixel of the poster (the title and sign-off sit near the edges) and extend the background into the bleed.
 */
export function fitFor(srcW: number, srcH: number, fullW: number, fullH: number): "cover" | "contain" {
  const diff = Math.abs(srcW / srcH - fullW / fullH) / (fullW / fullH);
  return diff <= MAX_CROP_ASPECT_DIFF ? "cover" : "contain";
}

/** Largest number of finished pieces per sheet, with bleed on each, a 3 mm gutter and a 10 mm margin. */
export function sheetGrid(sheetWmm: number, sheetHmm: number, p: PrintProfile, gutterMm = 3, marginMm = 10) {
  const cellW = p.widthMm + 2 * p.bleedMm;
  const cellH = p.heightMm + 2 * p.bleedMm;
  const cols = Math.max(0, Math.floor((sheetWmm - 2 * marginMm + gutterMm) / (cellW + gutterMm)));
  const rows = Math.max(0, Math.floor((sheetHmm - 2 * marginMm + gutterMm) / (cellH + gutterMm)));
  return { cols, rows, perSheet: cols * rows, cellW, cellH, gutterMm, marginMm };
}
