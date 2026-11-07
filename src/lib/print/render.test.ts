import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { PRINT_PROFILES, printGeometry } from "./profiles";

const poster = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 60 } } }).jpeg().toBuffer();

test("print files come out at the profile size with bleed and the right dpi", async () => {
  const { renderPrintFile } = await import("./render");
  for (const id of ["postcard", "card"] as const) {
    const g = printGeometry(PRINT_PROFILES[id]);
    const out = sharp(await renderPrintFile(await poster(1024, 1536), PRINT_PROFILES[id]));
    const meta = await out.metadata();
    assert.equal(meta.width, g.fullW, id);
    assert.equal(meta.height, g.fullH, id);
    assert.equal(meta.density, 300);
  }
});

test("a sheet repeats each file for its copies and adds pages as needed", async () => {
  const { composeSheets } = await import("./render");
  const jpeg = await poster(600, 900);
  const pdf = await PDFDocument.load(await composeSheets([{ jpeg, copies: 10 }], PRINT_PROFILES.magnet_5x7));
  assert.equal(pdf.getPageCount(), 2, "9 per A4 sheet, so 10 copies need two pages");
});
