import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast, PRESETS, themeVars, ThemeSchema, COLOR_KEYS } from "./theme-rules";

test("every preset keeps text readable on its backgrounds", () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    assert.ok(contrast(p.colors.ink, p.colors.canvas) >= 7, `${id}: ink on canvas`);
    assert.ok(contrast(p.colors.ink, p.colors.surface) >= 7, `${id}: ink on surface`);
    assert.ok(contrast(p.colors.muted, p.colors.canvas) >= 3.5, `${id}: muted on canvas`);
  }
});

test("only #rrggbb colours are accepted, so a theme cannot inject CSS", () => {
  assert.equal(ThemeSchema.safeParse({ colors: { accent: "red; background:url(x)" } }).success, false);
  assert.equal(ThemeSchema.safeParse({ colors: { accent: "#12ab9F" } }).success, true);
  assert.equal(ThemeSchema.safeParse({ preset: "nope" }).success, false);
});

test("overrides apply on top of the preset and only to the chosen variable", () => {
  const vars = themeVars(ThemeSchema.parse({ preset: "gold", colors: { accent: "#ff0000" } }));
  assert.equal(vars["--color-accent"], "#ff0000");
  assert.equal(vars["--color-canvas"], PRESETS.gold.colors.canvas);
  assert.equal(Object.keys(vars).filter((k) => k.startsWith("--color-")).length, COLOR_KEYS.length + 1);
});
