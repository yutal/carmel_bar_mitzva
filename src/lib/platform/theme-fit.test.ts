import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { contrast, hueDistance, toHsl } from "./color";
import { designThemeFromImage, takeDesignSlot } from "./theme-design";
import { fitTheme, paletteFromPixels, proposalFromPalette, ThemeProposalSchema, type ThemeProposal } from "./theme-fit";
import { COLOR_KEYS, PRESETS, themeWrapperStyle, type ColorKey } from "./theme-rules";

// Small seeded generator so the "random" tests fail the same way every time.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randomHex = (r: () => number) => `#${[0, 0, 0].map(() => Math.floor(r() * 256).toString(16).padStart(2, "0")).join("")}`;

/** An image-sized RGB buffer where each [hex, share] fills its share of the pixels, in order. */
function pixelsOf(parts: [string, number][], total = 10_000): Uint8Array {
  const out = new Uint8Array(total * 3);
  let i = 0;
  for (const [hex, share] of parts) {
    const n = Math.round(total * share);
    const rgb = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16));
    for (let k = 0; k < n && i < total; k++, i++) out.set(rgb, i * 3);
  }
  return out;
}

const NAVY = "#0b1d3a";
const GOLD = "#c9a227";

/** A good navy and gold proposal, with some fields replaced. `colors` may name only the colours to change. */
const proposal = (over: Partial<Omit<ThemeProposal, "colors">> & { colors?: Partial<Record<ColorKey, string>> } = {}): ThemeProposal => {
  const base = proposalFromPalette(paletteFromPixels(pixelsOf([[NAVY, 0.7], [GOLD, 0.2], ["#f4ead2", 0.1]])));
  return { ...base, ...over, colors: { ...base.colors, ...over.colors } };
};

test("the palette finds the big areas of a picture, biggest first", () => {
  const palette = paletteFromPixels(pixelsOf([[NAVY, 0.6], [GOLD, 0.25], ["#ffffff", 0.15]]));
  assert.equal(palette.length, 3);
  assert.deepEqual(palette.map((c) => c.share > 0.1), [true, true, true]);
  assert.ok(palette[0].share > palette[1].share && palette[1].share > palette[2].share);
  assert.equal(palette[0].hex, NAVY);
  assert.equal(palette[1].hex, GOLD);
  assert.ok(Math.abs(palette[0].share - 0.6) < 0.01);
});

test("nearby shades of one colour (a gradient, a soft shadow) count as one", () => {
  const shades = ["#1a2a6c", "#1c2c70", "#1e2e74", "#202f76", "#223178"].map((h): [string, number] => [h, 0.18]);
  const palette = paletteFromPixels(pixelsOf([...shades, ["#ffffff", 0.1]]));
  assert.equal(palette.length, 2);
  assert.ok(palette[0].share > 0.85);
});

test("transparent pixels are ignored, and an empty picture gives an empty palette", () => {
  const rgba = new Uint8Array(40 * 4);
  for (let i = 0; i < 40; i++) rgba.set(i < 10 ? [200, 30, 30, 255] : [0, 0, 0, 0], i * 4);
  const palette = paletteFromPixels(rgba, 4);
  assert.equal(palette.length, 1);
  assert.equal(palette[0].share, 1);
  assert.deepEqual(paletteFromPixels(new Uint8Array(0)), []);
});

test("from the colours alone, a navy and gold picture becomes a dark theme with a gold brand colour", () => {
  const p = proposalFromPalette(paletteFromPixels(pixelsOf([[NAVY, 0.7], [GOLD, 0.2], ["#f4ead2", 0.1]])));
  assert.equal(p.scheme, "dark");
  assert.ok(hueDistance(toHsl(p.colors.accent)[0], toHsl(GOLD)[0]) < 15, `accent ${p.colors.accent}`);
  const { theme } = fitTheme(p);
  assert.ok(hueDistance(toHsl(theme.colors.accent!)[0], toHsl(GOLD)[0]) < 20);
  assert.ok(contrast(theme.colors.ink!, theme.colors.canvas!) >= 7);
});

test("a pale picture with one bright colour becomes a light theme in that colour", () => {
  const p = proposalFromPalette(paletteFromPixels(pixelsOf([["#fbf4ec", 0.8], ["#d6336c", 0.12], ["#3b2a33", 0.08]])));
  assert.equal(p.scheme, "light");
  assert.ok(hueDistance(toHsl(p.colors.accent)[0], toHsl("#d6336c")[0]) < 15);
});

test("a mid-tone picture (a teal background) becomes a theme with a tinted page, not a mid-tone page", () => {
  const { theme } = fitTheme(proposalFromPalette(paletteFromPixels(pixelsOf([["#0f8b8d", 0.7], ["#ffffff", 0.2], ["#ec9a29", 0.1]]))));
  const c = theme.colors;
  assert.ok(contrast(c.ink!, c.canvas!) >= 7);
  assert.ok(hueDistance(toHsl(c.canvas!)[0], toHsl("#0f8b8d")[0]) < 20, "the page keeps the picture's hue");
});

test("a black and white picture still gives a usable theme", () => {
  const { theme } = fitTheme(proposalFromPalette(paletteFromPixels(pixelsOf([["#ffffff", 0.8], ["#111111", 0.2]]))));
  assert.ok(contrast(theme.colors.ink!, theme.colors.canvas!) >= 7);
  assert.ok(contrast(theme.colors.accent!, theme.colors.canvas!) >= 4.5);
});

test("whatever the model proposes, the fitted theme is valid and readable", () => {
  const r = rng(7);
  for (let n = 0; n < 400; n++) {
    const colors = Object.fromEntries(COLOR_KEYS.map((k) => [k, randomHex(r)])) as Record<ColorKey, string>;
    const { theme } = fitTheme(proposal({ colors, scheme: r() < 0.5 ? "dark" : "light" }));
    const c = theme.colors as Record<ColorKey, string>;
    for (const k of COLOR_KEYS) assert.match(c[k], /^#[0-9a-f]{6}$/, `${n}.${k}`);
    for (const bg of [c.canvas, c.surface]) assert.ok(contrast(c.ink, bg) >= 7, `${n}: ink on ${bg} (${JSON.stringify(colors)})`);
    for (const bg of [c.canvas, c.surface, c.tint]) {
      assert.ok(contrast(c.muted, bg) >= 4.5, `${n}: muted on ${bg}`);
      assert.ok(contrast(c.accent, bg) >= 4.5, `${n}: accent on ${bg}`);
    }
    assert.ok(contrast(c.highlight, c.canvas) >= 4.5, `${n}: highlight`);
    assert.ok(contrast(c.line, c.canvas) >= 1.1, `${n}: line`);
    assert.ok(contrast(c.ink, c.tint) >= 6.5, `${n}: ink on tint`);
  }
});

test("unusable colours from the model are replaced, not passed on", () => {
  const bad = { canvas: "red; background:url(//evil)", surface: "", ink: "#12", muted: "not a colour", accent: "#GGGGGG", accentSoft: "rgb(1,2,3)", line: "#fff;}", tint: "transparent", highlight: "" };
  const { theme, adjusted } = fitTheme(proposal({ colors: bad }));
  for (const k of COLOR_KEYS) assert.match(theme.colors[k]!, /^#[0-9a-f]{6}$/, k);
  assert.ok(adjusted.length >= 8);
  const style = JSON.stringify(themeWrapperStyle(theme));
  assert.doesNotMatch(style, /evil|url\(|;\s*}/);
});

test("short hex colours are understood", () => {
  const { theme } = fitTheme(proposal({ colors: { accent: "#C33" } }));
  assert.ok(hueDistance(toHsl(theme.colors.accent!)[0], 0) < 8);
});

test("a dark page stays dark and a light page stays light", () => {
  const dark = fitTheme(proposal({ scheme: "dark", colors: { canvas: "#101820", surface: "#18222d", ink: "#eeeeee" } })).theme;
  assert.ok(dark.colors.canvas === "#101820" && dark.colors.ink === "#eeeeee");
  const light = fitTheme(proposal({ scheme: "light", colors: { canvas: "#faf6ee", surface: "#ffffff", ink: "#222222" } })).theme;
  assert.equal(light.colors.canvas, "#faf6ee");
});

test("text that is too faint gets darker, keeping its hue; a mid-grey page is pushed to a real light or dark", () => {
  const faint = fitTheme(proposal({ scheme: "light", colors: { canvas: "#ffffff", surface: "#ffffff", ink: "#9aa0b8", muted: "#c4c8d8" } }));
  assert.ok(faint.adjusted.includes("ink") && faint.adjusted.includes("muted"));
  assert.ok(contrast(faint.theme.colors.ink!, "#ffffff") >= 7);
  assert.ok(Math.abs(toHsl(faint.theme.colors.ink!)[0] - toHsl("#9aa0b8")[0]) < 12);

  const grey = fitTheme(proposal({ scheme: "light", colors: { canvas: "#808080", surface: "#888888", ink: "#777777" } })).theme;
  assert.ok(contrast(grey.colors.ink!, grey.colors.canvas!) >= 7);
});

test("the headline is plain text of at most 40 characters", () => {
  const { theme } = fitTheme(proposal({ headline: "  <script>alert(1)</script>\n\n  הבר מצווה של דניאל  אהבה  ".padEnd(90, "!") }));
  assert.doesNotMatch(theme.headline, /[<>\n]/);
  assert.ok(theme.headline.length <= 40);
  assert.equal(fitTheme(proposal({ headline: "מזל טוב" })).theme.headline, "מזל טוב");
});

test("an unknown basedOn or a wrong font falls back to something valid", () => {
  const { theme } = fitTheme(proposal({ basedOn: "does-not-exist", fonts: "Comic Sans" as never, shape: "wavy" as never, backdrop: "video" as never }));
  assert.ok(theme.preset in PRESETS);
  assert.equal(theme.fonts, undefined);
  assert.equal(theme.shape, undefined);
  assert.equal(theme.backdrop, undefined);
});

test("what the model must return is a strict, complete schema", () => {
  const ok = ThemeProposalSchema.safeParse(proposal());
  assert.equal(ok.success, true);
  assert.equal(ThemeProposalSchema.safeParse({ ...proposal(), shape: "wavy" }).success, false);
});

async function invitation() {
  // A navy invitation with a gold frame and a cream panel: the colours a real one would have.
  return sharp({ create: { width: 600, height: 840, channels: 3, background: NAVY } })
    .composite([
      { input: { create: { width: 520, height: 760, channels: 3, background: GOLD } }, left: 40, top: 40 },
      { input: { create: { width: 500, height: 740, channels: 3, background: NAVY } }, left: 50, top: 50 },
      { input: { create: { width: 300, height: 120, channels: 3, background: "#f4ead2" } }, left: 150, top: 300 },
    ])
    .png()
    .toBuffer();
}

test("the pipeline turns an invitation into a theme, and says it used the model", async () => {
  const seen: { palette: number; hint: string }[] = [];
  const design = await designThemeFromImage(await invitation(), {
    hint: "להשאיר את הזהב",
    propose: async (_img, palette, hint) => {
      seen.push({ palette: palette.length, hint });
      return { ...proposalFromPalette(palette), headline: "הבר מצווה של דניאל", fonts: "formal", mood: "כחול עמוק וזהב" };
    },
  });
  assert.equal(design.source, "ai");
  assert.equal(design.theme.headline, "הבר מצווה של דניאל");
  assert.equal(design.theme.fonts, "formal");
  assert.equal(design.mood, "כחול עמוק וזהב");
  assert.ok(design.palette.includes(NAVY));
  assert.deepEqual(seen, [{ palette: design.palette.length, hint: "להשאיר את הזהב" }]);
  assert.ok(contrast(design.theme.colors.ink!, design.theme.colors.canvas!) >= 7);
  assert.equal(design.theme.hasLogo, false);
});

test("without the model, or when it fails, the theme comes from the measured colours", async () => {
  const never = async () => {
    throw new Error("must not be called");
  };
  const off = await designThemeFromImage(await invitation(), { propose: never, useAi: false });
  assert.equal(off.source, "palette");
  const broken = await designThemeFromImage(await invitation(), { propose: async () => { throw new Error("no key"); } });
  assert.equal(broken.source, "palette");
  const garbage = await designThemeFromImage(await invitation(), { propose: async () => ({ nonsense: true }) as never });
  assert.equal(garbage.source, "palette");
  for (const d of [off, broken, garbage]) {
    assert.ok(hueDistance(toHsl(d.theme.colors.accent!)[0], toHsl(GOLD)[0]) < 20);
    assert.ok(contrast(d.theme.colors.ink!, d.theme.colors.canvas!) >= 7);
  }
});

test("a thin gold frame on navy still gives a gold brand colour, not the mud that blurring leaves between them", async () => {
  // Thin strokes and diagonals, like a real invitation: most gold pixels sit next to navy and are anti-aliased.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1260">
    <rect width="900" height="1260" fill="${NAVY}"/>
    <rect x="50" y="50" width="800" height="1160" fill="none" stroke="${GOLD}" stroke-width="6"/>
    <rect x="76" y="76" width="748" height="1108" fill="none" stroke="${GOLD}" stroke-width="2"/>
    <line x1="150" y1="400" x2="750" y2="700" stroke="${GOLD}" stroke-width="3"/>
    <circle cx="450" cy="900" r="90" fill="none" stroke="#f4ead2" stroke-width="5"/>
  </svg>`;
  const image = await sharp(Buffer.from(svg)).png().toBuffer();
  const d = await designThemeFromImage(image, { propose: async () => { throw new Error("off"); } });
  assert.ok(d.palette.includes(GOLD), `palette ${d.palette.join(" ")}`);
  const accent = toHsl(d.theme.colors.accent!);
  assert.ok(hueDistance(accent[0], toHsl(GOLD)[0]) < 15, `accent ${d.theme.colors.accent}`);
  assert.ok(accent[1] > 0.5, "the brand colour is vivid");
  assert.ok(hueDistance(toHsl(d.theme.colors.highlight!)[0], toHsl(GOLD)[0]) < 25, `highlight ${d.theme.colors.highlight} stays in the gold family`);
});

test("a transparent logo is judged on white, and a picture that is not an image is refused", async () => {
  const logo = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 50, height: 50, channels: 3, background: "#d6336c" } }, left: 25, top: 25 }])
    .png()
    .toBuffer();
  const d = await designThemeFromImage(logo, { propose: async () => { throw new Error("off"); } });
  assert.ok(contrast(d.theme.colors.canvas!, "#ffffff") < 1.5, "a light page, not a black one");
  await assert.rejects(designThemeFromImage(Buffer.from("not an image"), { propose: async () => proposal() }));
});

test("one event can run only a few designs an hour", () => {
  const t0 = Date.parse("2026-11-08T10:00:00Z");
  const results = Array.from({ length: 14 }, () => takeDesignSlot("limit-test", t0));
  assert.equal(results.filter(Boolean).length, 12);
  assert.equal(takeDesignSlot("other-event", t0), true, "another event is not affected");
  assert.equal(takeDesignSlot("limit-test", t0 + 61 * 60_000), true, "the window moves on");
});
