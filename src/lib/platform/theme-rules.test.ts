import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKDROPS,
  COLOR_KEYS,
  contrast,
  DEFAULT_THEME,
  FONT_PAIRS,
  isCustom,
  PRESETS,
  SHAPES,
  themeVars,
  themeWrapperStyle,
  ThemeSchema,
} from "./theme-rules";

test("there are at least ten ready themes, each complete", () => {
  const ids = Object.keys(PRESETS);
  assert.ok(ids.length >= 10, `only ${ids.length} themes`);
  for (const [id, p] of Object.entries(PRESETS)) {
    assert.ok(p.label && p.hint, `${id}: label and hint`);
    assert.ok(p.fonts in FONT_PAIRS, `${id}: fonts`);
    assert.ok(p.shape in SHAPES, `${id}: shape`);
    assert.ok(p.backdrop in BACKDROPS, `${id}: backdrop`);
    for (const k of COLOR_KEYS) assert.match(p.colors[k], /^#[0-9a-f]{6}$/, `${id}.${k}`);
  }
  // Two themes that look the same would be padding.
  const looks = new Set(Object.values(PRESETS).map((p) => `${p.colors.canvas}${p.colors.accent}`));
  assert.equal(looks.size, ids.length);
});

test("every preset keeps text readable on its backgrounds", () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    const c = p.colors;
    assert.ok(contrast(c.ink, c.canvas) >= 7, `${id}: ink on canvas`);
    assert.ok(contrast(c.ink, c.surface) >= 7, `${id}: ink on surface`);
    assert.ok(contrast(c.ink, c.tint) >= 7, `${id}: ink on tint`);
    for (const bg of [c.canvas, c.surface, c.tint]) {
      assert.ok(contrast(c.muted, bg) >= 4.5, `${id}: muted on ${bg}`);
      assert.ok(contrast(c.accent, bg) >= 4.5, `${id}: accent on ${bg} (links, and the text of a chosen chip)`);
    }
    // The highlight colour is large text and badges only; the original olive default sits just under 3.
    assert.ok(contrast(c.highlight, c.canvas) >= 2.5, `${id}: highlight on canvas`);
    assert.ok(contrast(c.line, c.canvas) >= 1.1, `${id}: borders are visible`);
  }
});

test("only #rrggbb colours are accepted, so a theme cannot inject CSS", () => {
  assert.equal(ThemeSchema.safeParse({ colors: { accent: "red; background:url(x)" } }).success, false);
  assert.equal(ThemeSchema.safeParse({ colors: { accent: "#12ab9F" } }).success, true);
  assert.equal(ThemeSchema.safeParse({ preset: "nope" }).success, false);
  assert.equal(ThemeSchema.safeParse({ shape: "url(x)" }).success, false);
  assert.equal(ThemeSchema.safeParse({ backdrop: "url(http://evil)" }).success, false);
  assert.equal(ThemeSchema.safeParse({ fonts: "Comic Sans" }).success, false);
});

test("overrides apply on top of the preset and only to the chosen variable", () => {
  const vars = themeVars(ThemeSchema.parse({ preset: "gold", colors: { accent: "#ff0000" } }));
  assert.equal(vars["--color-accent"], "#ff0000");
  assert.equal(vars["--color-canvas"], PRESETS.gold.colors.canvas);
  assert.equal(Object.keys(vars).filter((k) => k.startsWith("--color-")).length, COLOR_KEYS.length + 1);
});

test("shape and fonts come from the preset unless the theme overrides them", () => {
  assert.equal(themeVars(ThemeSchema.parse({ preset: "arena" }))["--btn-radius"], SHAPES.sharp.button);
  assert.equal(themeVars(ThemeSchema.parse({ preset: "arena", shape: "round" }))["--btn-radius"], SHAPES.round.button);
  assert.equal(themeVars(ThemeSchema.parse({ preset: "arena", shape: "round" }))["--radius-3xl"], SHAPES.round.radius["3xl"]);
  assert.match(themeVars(ThemeSchema.parse({ preset: "royal" }))["--font-display"], /--font-david/);
  assert.match(themeVars(ThemeSchema.parse({ preset: "royal", fonts: "playful" }))["--font-display"], /--font-secular/);
});

test("the wrapper style carries the backdrop, and only values built from the theme's own variables", () => {
  assert.equal(themeWrapperStyle(ThemeSchema.parse({ preset: "olive" })).backgroundImage, undefined);
  for (const b of ["glow", "dots", "stripes", "confetti"] as const) {
    const style = themeWrapperStyle(ThemeSchema.parse({ backdrop: b }));
    assert.ok(style.backgroundImage, b);
    assert.doesNotMatch(style.backgroundImage, /url\(/, b);
    assert.equal(style.backgroundColor, "var(--color-canvas)");
  }
  assert.equal(themeWrapperStyle(ThemeSchema.parse({ preset: "gold" })).backgroundImage?.includes("radial-gradient"), true);
  assert.equal(themeWrapperStyle(ThemeSchema.parse({ preset: "gold", backdrop: "plain" })).backgroundImage, undefined);
});

test("only a ready theme is allowed without a custom-theme licence", () => {
  assert.equal(isCustom(DEFAULT_THEME), false);
  assert.equal(isCustom(ThemeSchema.parse({ preset: "gold" })), false);
  assert.equal(isCustom(ThemeSchema.parse({ colors: { accent: "#ff0000" } })), true);
  assert.equal(isCustom(ThemeSchema.parse({ shape: "sharp" })), true);
  assert.equal(isCustom(ThemeSchema.parse({ backdrop: "dots" })), true);
  assert.equal(isCustom(ThemeSchema.parse({ fonts: "bold" })), true);
  assert.equal(isCustom(ThemeSchema.parse({ headline: "מזל טוב" })), true);
});
