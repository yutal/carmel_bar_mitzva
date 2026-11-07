import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import sharp, { type Sharp } from "sharp";
import { fitFor, printGeometry, sheetGrid, type PrintProfile } from "./profiles";

/**
 * Turns a finished poster into a print file: the profile's size at its dpi with bleed on every side.
 * The poster's title and sign-off are already drawn into it (by our canvas, not the image model), so they scale
 * with it and stay sharp. Upscaling is Lanczos with a light sharpen; swap in a model upscaler here later without
 * touching the queue or the routes.
 */
export async function renderPrintFile(poster: Buffer, profile: PrintProfile): Promise<Buffer> {
  const { fullW, fullH } = printGeometry(profile);
  const img = sharp(poster, { failOn: "error" }).rotate();
  const meta = await img.metadata();
  const fit = fitFor(meta.width ?? 1, meta.height ?? 1, fullW, fullH);

  const scaled = (img.clone().resize(fullW, fullH, { fit: fit === "cover" ? "cover" : "inside", kernel: "lanczos3" }));
  let canvas: Sharp;
  if (fit === "cover") {
    canvas = scaled;
  } else {
    // The poster stays whole in the middle; its own enlarged, blurred copy fills the bleed and the sides.
    const background = await img.clone().resize(fullW, fullH, { fit: "cover" }).blur(40).modulate({ brightness: 0.85 }).toBuffer();
    canvas = sharp(background).composite([{ input: await scaled.toBuffer(), gravity: "centre" }]);
  }
  return canvas
    .sharpen({ sigma: 0.7, m1: 0.6, m2: 1.2 })
    .withMetadata({ density: profile.dpi })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

const MM = 72 / 25.4;

/**
 * An A4 sheet (portrait) of print files, `copies` of each, laid out in a grid with crop marks at the trim lines.
 * Hand it to a print shop or print it at 100%.
 */
export async function composeSheets(files: { jpeg: Buffer; copies: number }[], profile: PrintProfile): Promise<Uint8Array> {
  const grid = sheetGrid(210, 297, profile);
  if (!grid.perSheet) throw new Error("The size does not fit on an A4 sheet");
  const pdf = await PDFDocument.create();
  const pieces = files.flatMap((f) => Array.from({ length: f.copies }, () => f.jpeg));
  const embedded = new Map<Buffer, Awaited<ReturnType<typeof pdf.embedJpg>>>();
  for (let start = 0; start < pieces.length; start += grid.perSheet) {
    const page = pdf.addPage([210 * MM, 297 * MM]);
    const usedW = grid.cols * grid.cellW + (grid.cols - 1) * grid.gutterMm;
    const usedH = grid.rows * grid.cellH + (grid.rows - 1) * grid.gutterMm;
    const x0 = (210 - usedW) / 2;
    const y0 = (297 - usedH) / 2;
    for (const [i, jpeg] of pieces.slice(start, start + grid.perSheet).entries()) {
      let img = embedded.get(jpeg);
      if (!img) embedded.set(jpeg, (img = await pdf.embedJpg(jpeg)));
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      const x = x0 + col * (grid.cellW + grid.gutterMm);
      const yTop = y0 + row * (grid.cellH + grid.gutterMm);
      const bottom = 297 - yTop - grid.cellH;
      page.drawImage(img, { x: x * MM, y: bottom * MM, width: grid.cellW * MM, height: grid.cellH * MM });
      // Crop marks just outside the trim corners.
      const tx0 = x + profile.bleedMm;
      const tx1 = tx0 + profile.widthMm;
      const ty0 = bottom + profile.bleedMm;
      const ty1 = ty0 + profile.heightMm;
      const mark = (ax: number, ay: number, bx: number, by: number) =>
        page.drawLine({ start: { x: ax * MM, y: ay * MM }, end: { x: bx * MM, y: by * MM }, thickness: 0.4, color: rgb(0, 0, 0) });
      for (const tx of [tx0, tx1]) {
        mark(tx, ty0 - 0.5, tx, ty0 - 0.5 - Math.min(1.5, profile.bleedMm));
        mark(tx, ty1 + 0.5, tx, ty1 + 0.5 + Math.min(1.5, profile.bleedMm));
      }
      for (const ty of [ty0, ty1]) {
        mark(tx0 - 0.5, ty, tx0 - 0.5 - Math.min(1.5, profile.bleedMm), ty);
        mark(tx1 + 0.5, ty, tx1 + 0.5 + Math.min(1.5, profile.bleedMm), ty);
      }
    }
  }
  return pdf.save();
}

/** Copies a finished file into the printer's hot folder (PRINT_HOT_FOLDER), where DNP-style printers pick it up. */
export async function copyToHotFolder(dir: string | undefined, name: string, jpeg: Buffer): Promise<boolean> {
  if (!dir) return false;
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, path.basename(name)), jpeg);
    return true;
  } catch (err) {
    console.error("[print] hot folder write failed", err);
    return false;
  }
}
