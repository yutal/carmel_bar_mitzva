import assert from "node:assert/strict";
import { test } from "node:test";
import { fitFor, PRINT_PROFILES, printGeometry, sheetGrid } from "./profiles";

test("a 10x15 postcard is 1200x1800 px at 300 dpi, plus bleed on every side", () => {
  const g = printGeometry(PRINT_PROFILES.postcard);
  assert.equal(g.trimW, 1181);
  assert.equal(g.trimH, 1772);
  assert.equal(g.fullW, g.trimW + 2 * g.bleed);
  assert.equal(g.fullH, g.trimH + 2 * g.bleed);
});

test("2:3 posters fill 2:3 magnets, and a different shape keeps the whole poster", () => {
  const magnet = printGeometry(PRINT_PROFILES.magnet_5x7);
  assert.equal(fitFor(1024, 1536, magnet.fullW, magnet.fullH), "cover");
  const card = printGeometry(PRINT_PROFILES.card);
  assert.equal(fitFor(1024, 1536, card.fullW, card.fullH), "contain");
});

test("the A4 sheet holds whole magnets with their bleed", () => {
  const g = sheetGrid(210, 297, PRINT_PROFILES.magnet_5x7);
  assert.equal(g.perSheet, 9);
  assert.ok(g.cols * g.cellW + (g.cols - 1) * g.gutterMm + 2 * g.marginMm <= 210);
  assert.equal(sheetGrid(210, 297, { ...PRINT_PROFILES.postcard, widthMm: 400 }).perSheet, 0);
});
