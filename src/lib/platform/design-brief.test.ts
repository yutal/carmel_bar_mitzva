import assert from "node:assert/strict";
import { test } from "node:test";
import { PRINT_PROFILES, printGeometry } from "../print/profiles";
import {
  aspectOf,
  applyBriefInput,
  ASSET_ROLES,
  BriefInputSchema,
  briefToMarkdown,
  DeliverableSchema,
  designTokens,
  ELEMENT_IDS,
  ELEMENTS,
  emptyBrief,
  isAssetId,
  KIND_IDS,
  KINDS,
  MAX_DELIVERABLES,
  newDeliverable,
  PlacementSchema,
  placeWords,
  SIZE_IDS,
  SIZES,
  type Asset,
  type Brief,
} from "./design-brief";
import { DEFAULT_THEME, type Theme } from "./theme-rules";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const asset = (id: string, role: Asset["role"] = "reference"): Asset => ({ id, role, name: `${id}.png`, ext: "png", addedAt: NOW.toISOString() });
const withAssets = (...ids: string[]): Brief => ({ ...emptyBrief(), assets: ids.map((i) => asset(i)) });
const md = (brief: Brief, theme: Theme = DEFAULT_THEME) => briefToMarkdown(brief, { theme, themeFile: "../theme.json", assetFile: (a) => `assets/${a.id}.${a.ext}` });

test("every kind points at a size that exists, and every size has a frame to draw", () => {
  for (const k of KIND_IDS) assert.ok(KINDS[k].size in SIZES, `${k} -> ${KINDS[k].size}`);
  for (const id of SIZE_IDS) {
    const a = aspectOf(id);
    assert.ok(a > 0.2 && a < 5, `${id}: aspect ${a}`);
  }
});

test("print sizes agree with the print profiles, bleed included", () => {
  for (const [id, p] of Object.entries(PRINT_PROFILES)) {
    const g = printGeometry(p);
    const s = SIZES[id];
    assert.ok(s?.print, `${id} is a print size`);
    assert.equal(s.widthPx, g.fullW);
    assert.equal(s.heightPx, g.fullH);
    assert.deepEqual(s.print.trimPx, { w: g.trimW, h: g.trimH });
  }
  // the frame is the finished piece, so the aspect ignores the bleed
  assert.ok(Math.abs(aspectOf("magnet_5x7") - 50 / 75) < 0.01);
  assert.ok(Math.abs(aspectOf("a5_sign") - 148 / 210) < 0.01);
  assert.equal(aspectOf("phone_screen"), 390 / 844);
  assert.equal(aspectOf("does-not-exist"), 1);
});

test("a new piece of every kind is valid and starts with the elements that belong on it", () => {
  for (const k of KIND_IDS) {
    const d = newDeliverable(k, "d0123abcd");
    assert.equal(DeliverableSchema.safeParse(d).success, true, k);
    assert.equal(d.size, KINDS[k].size);
    assert.ok(Object.keys(d.elements).every((e) => (ELEMENT_IDS as string[]).includes(e)));
  }
  assert.ok(newDeliverable("magnet", "d0123abcd").elements.title);
  assert.ok(newDeliverable("sign", "d0123abcd").elements.qr);
  assert.deepEqual(newDeliverable("other", "d0123abcd").elements, {});
});

test("every default position is inside the piece", () => {
  for (const [id, el] of Object.entries(ELEMENTS)) {
    assert.equal(PlacementSchema.safeParse(el.at).success, true, id);
  }
});

test("positions outside the piece and unknown sizes are refused", () => {
  assert.equal(PlacementSchema.safeParse({ x: 1.01, y: 0.5 }).success, false);
  assert.equal(PlacementSchema.safeParse({ x: 0.5, y: -0.1 }).success, false);
  assert.equal(PlacementSchema.safeParse({ x: 0.5, y: 0.5, size: "xl" }).success, false);
  assert.deepEqual(PlacementSchema.parse({ x: 0.2, y: 0.8 }), { x: 0.2, y: 0.8, size: "m", align: "center" });

  const d = newDeliverable("magnet", "d0123abcd");
  assert.equal(DeliverableSchema.safeParse({ ...d, size: "nope" }).success, false);
  assert.equal(DeliverableSchema.safeParse({ ...d, kind: "nope" }).success, false);
  assert.equal(DeliverableSchema.safeParse({ ...d, id: "../etc/passwd" }).success, false);
  assert.equal(DeliverableSchema.safeParse({ ...d, name: "   " }).success, false);
  assert.equal(DeliverableSchema.safeParse({ ...d, notes: "x".repeat(2001) }).success, false);
  assert.equal(DeliverableSchema.safeParse({ ...d, elements: { title: { x: 2, y: 0 } } }).success, false);
  assert.equal(DeliverableSchema.safeParse({ ...d, elements: { fireworks: { x: 0.5, y: 0.5 } } }).success, false);
});

test("asset ids are one fixed shape, so they can never be a path", () => {
  assert.equal(isAssetId("a0123abcd"), true);
  for (const bad of ["", "a0123ABCD", "a0123abc", "a0123abcde", "b0123abcd", "../a0123abcd", "a0123abcd.png", "a0123abc/", 5, null, undefined]) {
    assert.equal(isAssetId(bad), false, String(bad));
  }
});

test("saving fills in the blanks, trims the text and caps the number of pieces", () => {
  const parsed = BriefInputSchema.parse({ event: { title: "  בר מצווה לדוד  " }, branding: {} });
  assert.equal(parsed.event.title, "בר מצווה לדוד");
  assert.equal(parsed.event.language, "he");
  assert.deepEqual(parsed.deliverables, []);

  const many = Array.from({ length: MAX_DELIVERABLES + 1 }, (_, i) => newDeliverable("other", `d${String(i).padStart(8, "0")}`));
  assert.equal(BriefInputSchema.safeParse({ event: {}, branding: {}, deliverables: many }).success, false);
  assert.equal(BriefInputSchema.safeParse({ event: {}, branding: {}, deliverables: many.slice(0, MAX_DELIVERABLES) }).success, true);
  assert.equal(BriefInputSchema.safeParse({ event: { title: "x".repeat(81) }, branding: {} }).success, false);
  assert.equal(BriefInputSchema.safeParse({ event: { language: "fr" }, branding: {} }).success, false);
});

test("a client cannot change the asset list, and references to missing pictures are dropped", () => {
  const current = withAssets("a00000001", "a00000002");
  const d = { ...newDeliverable("invitation", "d00000001"), references: ["a00000001", "a00000001", "a0000000f"] };
  const input = BriefInputSchema.parse({ event: { title: "T" }, branding: { tone: "warm" }, deliverables: [d], assets: [asset("a000000ff")] });
  const out = applyBriefInput(current, input, "guy", NOW);
  assert.ok("brief" in out);
  assert.deepEqual(out.brief.assets.map((a) => a.id), ["a00000001", "a00000002"]);
  assert.deepEqual(out.brief.deliverables[0].references, ["a00000001"]);
  assert.equal(out.brief.updatedBy, "guy");
  assert.equal(out.brief.updatedAt, NOW.toISOString());
  assert.equal(out.brief.event.title, "T");
  assert.equal(out.brief.branding.tone, "warm");
});

test("two pieces with the same id are refused", () => {
  const d = newDeliverable("magnet", "d00000001");
  const input = BriefInputSchema.parse({ event: {}, branding: {}, deliverables: [d, { ...d, name: "other" }] });
  const out = applyBriefInput(emptyBrief(), input, "guy", NOW);
  assert.ok("error" in out);
});

test("words for a position follow what the eye sees", () => {
  assert.equal(placeWords({ x: 0.5, y: 0.5 }), "centre");
  assert.equal(placeWords({ x: 0.5, y: 0.1 }), "top centre");
  assert.equal(placeWords({ x: 0.9, y: 0.9 }), "bottom right");
  assert.equal(placeWords({ x: 0.1, y: 0.5 }), "middle left");
  assert.equal(placeWords({ x: 0.1, y: 0.1 }), "top left");
});

test("the readable brief carries the exact texts, sizes, positions and pictures", () => {
  const current: Brief = { ...withAssets("a00000001", "a00000002"), assets: [asset("a00000001", "invitation"), asset("a00000002", "logo")] };
  const magnet = { ...newDeliverable("magnet", "d00000001"), name: "מגנט ראשי", notes: "זהב על ירוק\n\nבלי פרחים", references: ["a00000001"] };
  magnet.elements = { title: { x: 0.5, y: 0.12, size: "l", align: "center" }, date: { x: 0.3, y: 0.9, size: "s", align: "start" } };
  const input = BriefInputSchema.parse({
    event: { title: "בר מצווה לדוד", dateText: "י״ב בסיוון תשפ״ז", venueText: "אולם הכרמל", language: "he" },
    branding: { tone: "חגיגי אבל לא כבד", likes: "זהב", avoid: "ורוד" },
    deliverables: [magnet, newDeliverable("ui", "d00000002")],
  });
  const out = applyBriefInput(current, input, "guy", NOW);
  assert.ok("brief" in out);
  const text = md(out.brief);

  for (const must of [
    "בר מצווה לדוד",
    "י״ב בסיוון תשפ״ז",
    "אולם הכרמל",
    "right to left",
    "חגיגי אבל לא כבד",
    "assets/a00000001.png",
    "assets/a00000002.png",
    "מגנט ראשי",
    "top centre",
    "bottom left",
    "centre at 50% across and 12% down",
    "text height about 11%",
  ]) {
    assert.ok(text.includes(must), `missing: ${must}\n${text}`);
  }
  assert.ok(text.includes("זהב על ירוק בלי פרחים"), "line breaks in notes are folded to one line");
  assert.ok(text.includes("Look at: assets/a00000001.png"));
  assert.ok(text.includes("../theme.json"));
  assert.ok(text.includes("mm bleed on every side"), "print geometry is spelled out");
  assert.ok(text.includes(`${SIZES.magnet_5x7.widthPx}×${SIZES.magnet_5x7.heightPx} px`));
  assert.ok(text.includes("390×844 px"));
});

test("alignment is described in the direction of the language", () => {
  const d = newDeliverable("invitation", "d00000001");
  d.elements = { title: { x: 0.8, y: 0.2, size: "m", align: "start" } };
  const base = BriefInputSchema.parse({ event: { title: "T", language: "he" }, branding: {}, deliverables: [d] });
  const he = applyBriefInput(emptyBrief(), base, "x", NOW);
  const en = applyBriefInput(emptyBrief(), { ...base, event: { ...base.event, language: "en" } }, "x", NOW);
  assert.ok("brief" in he && "brief" in en);
  assert.ok(md(he.brief).includes("aligned to the right edge"));
  assert.ok(md(en.brief).includes("aligned to the left edge"));
});

test("an empty brief reads sensibly instead of printing blanks", () => {
  const text = md(emptyBrief());
  assert.ok(text.includes("(no title yet)"));
  assert.ok(text.includes("Nothing yet."));
  assert.ok(!text.includes("undefined"));
  assert.ok(!text.includes("NaN"));
  assert.ok(!text.includes("## Pictures"));
});

test("a title that mentions asset ids or markdown does not break the document structure", () => {
  const input = BriefInputSchema.parse({ event: { title: "# not a heading\n- not a bullet" }, branding: {} });
  const out = applyBriefInput(emptyBrief(), input, "x", NOW);
  assert.ok("brief" in out);
  const lines = md(out.brief).split("\n");
  // the first heading is the document's own; the title text never starts a line of its own
  assert.equal(lines.filter((l) => l.startsWith("# ")).length, 1);
  assert.ok(!lines.some((l) => l.startsWith("- not a bullet")));
});

test("design tokens expose colours, fonts and CSS variables, but not layout styles", () => {
  const t = designTokens(DEFAULT_THEME);
  assert.match(t.colors.canvas, /^#[0-9a-f]{6}$/);
  assert.match(t.colors.accent, /^#[0-9a-f]{6}$/);
  assert.ok(t.fonts.label && t.shape.label && t.backdrop.label);
  const names = Object.keys(t.cssVariables);
  assert.ok(names.length > 5);
  assert.ok(names.every((n) => n.startsWith("--")), names.join(", "));
  assert.ok(!("minHeight" in t.cssVariables) && !("backgroundColor" in t.cssVariables));
});

test("asset roles all have a Hebrew label", () => {
  for (const [k, v] of Object.entries(ASSET_ROLES)) assert.ok(v.length > 0, k);
});
