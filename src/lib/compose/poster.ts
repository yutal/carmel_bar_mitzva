import "server-only";
import path from "node:path";
import { GlobalFonts, createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { config } from "@/lib/config";
import { isRtlText, type Lang } from "@/lib/i18n";
import type { FaceBox, ImageStyle } from "@/lib/types";

const ACCENT = "#E4E9C6"; // pale olive, readable on the dark band
const CLAY = "#E9A27E";
const WHITE = "#FFFFFF";
const COMIC_YELLOW = "#FFD23F";
export const TITLE_FONT = "Frank Ruhl Libre";
export const BODY_FONT = "Heebo";

let fontsLoaded = false;
export function loadFonts() {
  if (fontsLoaded) return;
  GlobalFonts.registerFromPath(path.join(config.fontsDir, "FrankRuhlLibre.ttf"), TITLE_FONT);
  GlobalFonts.registerFromPath(path.join(config.fontsDir, "Heebo.ttf"), BODY_FONT);
  fontsLoaded = true;
}

type TextBlock = { text: string; font: (size: number) => string; maxSize: number; minSize: number; maxLines: number };

export function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Largest font size at which the text fits in maxLines lines. */
function fit(ctx: SKRSContext2D, block: TextBlock, maxWidth: number): { size: number; lines: string[] } {
  for (let size = block.maxSize; size >= block.minSize; size -= 2) {
    ctx.font = block.font(size);
    const lines = wrap(ctx, block.text, maxWidth);
    if (lines.length <= block.maxLines) return { size, lines };
  }
  ctx.font = block.font(block.minSize);
  const lines = wrap(ctx, block.text, maxWidth);
  const kept = lines.slice(0, block.maxLines);
  if (lines.length > block.maxLines) kept[kept.length - 1] += "…";
  return { size: block.minSize, lines: kept };
}

/** Each line gets its own base direction, so Hebrew and English (or a mix) keep punctuation on the right side. */
export function fillText(ctx: SKRSContext2D, text: string, x: number, y: number) {
  ctx.direction = isRtlText(text) ? "rtl" : "ltr";
  ctx.fillText(text, x, y);
}

function strokeText(ctx: SKRSContext2D, text: string, x: number, y: number) {
  ctx.direction = isRtlText(text) ? "rtl" : "ltr";
  ctx.strokeText(text, x, y);
}

export function drawLines(ctx: SKRSContext2D, lines: string[], x: number, y: number, lineHeight: number): number {
  // One direction for the whole paragraph, from its first letter, like a browser would.
  ctx.direction = isRtlText(lines.join(" ")) ? "rtl" : "ltr";
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function shade(ctx: SKRSContext2D, w: number, from: number, to: number, alphaFrom: number, alphaTo: number) {
  const g = ctx.createLinearGradient(0, from, 0, to);
  g.addColorStop(0, `rgba(24,28,14,${alphaFrom})`);
  g.addColorStop(1, `rgba(24,28,14,${alphaTo})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.min(from, to), w, Math.abs(to - from));
}

function prepare(ctx: SKRSContext2D) {
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 12;
}

export type PosterText = {
  style: ImageStyle;
  title: string;
  tagline: string;
  coverLines: string[];
  stats: { label: string; value: number }[];
  /** "With love, <name> · <relationship>". The blessing itself is not printed: it lives on the result page and in the album. */
  sender: string;
  footer: string;
  /** Faces in the art; text is laid out so it never covers one. */
  faces?: FaceBox[];
  /** Language of the creation; picks the fixed words drawn on it. */
  lang?: Lang;
  /** Magazine style: the magazine's name, i.e. the celebrant's name. */
  masthead?: string;
};

/** Fixed words drawn on the creations, per language. */
const POSTER_WORDS: Record<Lang, { issue: string; badge: string }> = {
  he: { issue: "גיליון מיוחד · בר מצווה · 13", badge: "בר מצווה" },
  en: { issue: "SPECIAL ISSUE · BAR MITZVAH · 13", badge: "BAR MITZVAH" },
};

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Face boxes in pixels, with a margin so letters do not touch a chin or an ear. */
function faceBoxes(faces: FaceBox[] | undefined, w: number, h: number): Box[] {
  return (faces ?? []).map((f) => ({
    x0: Math.max(0, Math.min(f.left, f.right) * w - w * 0.03),
    x1: Math.min(w, Math.max(f.left, f.right) * w + w * 0.03),
    y0: Math.max(0, Math.min(f.top, f.bottom) * h - h * 0.02),
    y1: Math.min(h, Math.max(f.top, f.bottom) * h + h * 0.02),
  }));
}

/** Highest point of any face, or the bottom of the image when there are none. */
const facesTop = (faces: Box[], h: number) => Math.min(h, ...faces.map((f) => f.y0));
const facesBottom = (faces: Box[]) => Math.max(0, ...faces.map((f) => f.y1));

/** Final image: generated art + title and sign-off (Hebrew or English), rendered here (not by the model). */
export async function composePoster(art: Buffer, text: PosterText): Promise<Buffer> {
  loadFonts();
  const img = await loadImage(art);
  const w = img.width;
  const h = img.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  if (text.style === "magazine") drawMagazine(ctx, img, w, h, text);
  else if (text.style === "card") drawCard(ctx, img, w, h, text);
  else drawMoviePoster(ctx, img, w, h, text);

  return canvas.toBuffer("image/png");
}

type Img = Awaited<ReturnType<typeof loadImage>>;

/** Footer and sender stacked upwards from `bottom`. Returns the top of the sender line. */
function drawSignOff(ctx: SKRSContext2D, w: number, bottom: number, text: PosterText, scale = 1, draw = true): number {
  const cx = w / 2;
  const footerSize = Math.round(w * 0.026 * scale);
  const senderSize = Math.round(w * 0.036 * scale);
  const senderY = bottom - footerSize * 3;
  if (draw) {
    ctx.fillStyle = ACCENT;
    ctx.font = `500 ${footerSize}px "${BODY_FONT}"`;
    fillText(ctx, text.footer, cx, bottom);
    ctx.fillRect(cx - w * 0.12, bottom - footerSize * 1.6, w * 0.24, 2);
    ctx.fillStyle = CLAY;
    ctx.font = `700 ${senderSize}px "${BODY_FONT}"`;
    fillText(ctx, text.sender, cx, senderY);
  }
  return senderY - senderSize;
}

/** The sign-off, made smaller until it clears every face. Returns its top. */
function placeSignOff(ctx: SKRSContext2D, w: number, bottom: number, text: PosterText, scale: number, faces: Box[]): number {
  const low = facesBottom(faces);
  let chosen = scale * 0.65;
  for (let sc = scale; sc >= scale * 0.65; sc -= 0.05) {
    if (drawSignOff(ctx, w, bottom, text, sc, false) >= low) {
      chosen = sc;
      break;
    }
  }
  return drawSignOff(ctx, w, bottom, text, chosen);
}

/** Movie, animation, comic and toy box: title on top, sign-off at the bottom, both kept off the faces. */
function drawMoviePoster(ctx: SKRSContext2D, img: Img, w: number, h: number, text: PosterText) {
  ctx.drawImage(img, 0, 0, w, h);
  const cx = w / 2;
  const faces = faceBoxes(text.faces, w, h);
  shade(ctx, w, 0, h * 0.24, 0.75, 0);
  shade(ctx, w, h * 0.55, h, 0, 0.92);
  prepare(ctx);

  // Largest title (and tagline) whose block ends above the highest face.
  const ceiling = facesTop(faces, h);
  const taglineSize = Math.round(w * 0.032);
  let title = { size: 0, lines: [] as string[] };
  let tagline = text.tagline;
  const blockBottom = () => h * 0.035 + title.size + (title.lines.length - 1) * title.size * 1.05 + (tagline ? w * 0.025 + taglineSize * 0.3 : title.size * 0.25);
  for (let max = Math.round(w * 0.11); max >= Math.round(w * 0.06); max -= 4) {
    title = fit(ctx, { text: text.title, font: (s) => `900 ${s}px "${TITLE_FONT}"`, maxSize: max, minSize: Math.round(w * 0.06), maxLines: 2 }, w * 0.86);
    if (blockBottom() <= ceiling) break;
  }
  // A face very high in the frame: the tagline gives way before anything lands on it.
  if (blockBottom() > ceiling) tagline = "";

  const comic = text.style === "comic";
  ctx.font = `900 ${title.size}px "${TITLE_FONT}"`;
  const titleY = h * 0.035 + title.size;
  if (comic) {
    // Comic masthead: yellow letters with a heavy ink outline.
    ctx.lineJoin = "round";
    ctx.lineWidth = title.size * 0.14;
    ctx.strokeStyle = "#1A1A1A";
    title.lines.forEach((line, i) => strokeText(ctx, line, cx, titleY + i * title.size * 1.05));
    ctx.fillStyle = COMIC_YELLOW;
  } else {
    ctx.fillStyle = ACCENT;
  }
  const y = drawLines(ctx, title.lines, cx, titleY, title.size * 1.05);
  if (tagline) {
    ctx.fillStyle = WHITE;
    ctx.font = `500 ${taglineSize}px "${BODY_FONT}"`;
    drawLines(ctx, [tagline], cx, y + w * 0.025, 0);
  }
  placeSignOff(ctx, w, h - h * 0.03, text, 1, faces);
}

type CoverSpot = { x: number; align: "left" | "right"; y: number; scale: number; count: number };

/** Heights of the cover-line stack at a given scale, using the same sizes it is drawn with. */
function coverStack(ctx: SKRSContext2D, lines: string[], w: number, h: number, colWidth: number, scale: number) {
  return lines.map((line, i) => {
    const size = Math.round(w * (i === 0 ? 0.052 : 0.04) * scale);
    const block = fit(ctx, { text: line, font: (s) => `900 ${s}px "${BODY_FONT}"`, maxSize: size, minSize: Math.min(size, 20), maxLines: 3 }, colWidth);
    return { block, height: block.size * 1.25 + block.lines.length * block.size * 1.12 + h * 0.03 };
  });
}

/**
 * Finds room for the cover lines in the right or left column, between the masthead and the sign-off,
 * where no face is. Prefers the right side, more lines and larger text. Undefined when nothing fits.
 */
function findCoverSpot(ctx: SKRSContext2D, lines: string[], w: number, h: number, top: number, bottom: number, faces: Box[], colWidth: number): CoverSpot | undefined {
  const columns = [
    { x: w * 0.95, align: "right" as const, x0: w * 0.95 - colWidth, x1: w * 0.95 },
    { x: w * 0.05, align: "left" as const, x0: w * 0.05, x1: w * 0.05 + colWidth },
  ];
  for (let count = Math.min(3, lines.length); count >= 1; count--) {
    for (let scale = 1; scale >= 0.6; scale -= 0.1) {
      const height = coverStack(ctx, lines.slice(0, count), w, h, colWidth, scale).reduce((n, b) => n + b.height, 0);
      for (const col of columns) {
        // Walk down the column: start at the top, jump below any face in the way.
        let y = Math.max(top, h * 0.24);
        for (let guard = 0; guard < 10 && y + height <= bottom; guard++) {
          const clash = faces.find((f) => f.x0 < col.x1 && col.x0 < f.x1 && f.y0 < y + height && y < f.y1);
          if (!clash) return { x: col.x, align: col.align, y, scale, count };
          y = clash.y1;
        }
      }
    }
  }
  return undefined;
}

const MAGAZINE_RED = "#E03A2F";

/**
 * Magazine cover: the celebrant's name as the masthead, an issue line above it, the concept title as the
 * main headline at the bottom, and cover lines in whichever side column is free of faces.
 */
function drawMagazine(ctx: SKRSContext2D, img: Img, w: number, h: number, text: PosterText) {
  ctx.drawImage(img, 0, 0, w, h);
  const faces = faceBoxes(text.faces, w, h);
  shade(ctx, w, 0, h * 0.2, 0.4, 0);
  shade(ctx, w, h * 0.58, h, 0, 0.94);
  prepare(ctx);
  const words = POSTER_WORDS[text.lang ?? "he"];

  // Issue line, then the masthead as big as one line allows. Hair may overlap the masthead; faces may not.
  const ceiling = facesTop(faces, h);
  const issueSize = Math.round(w * 0.022);
  const issueY = h * 0.014 + issueSize;
  ctx.fillStyle = WHITE;
  ctx.font = `700 ${issueSize}px "${BODY_FONT}"`;
  fillText(ctx, words.issue, w / 2, issueY);
  const masthead = text.masthead ?? text.title;
  const mastFont = (size: number) => `900 ${size}px "${BODY_FONT}"`;
  // One word is never wrapped, so size it by its measured width: as wide as the cover, at most 30% of the width tall.
  ctx.font = mastFont(100);
  let mastSize = Math.max(Math.round(w * 0.1), Math.min(Math.round(w * 0.3), Math.floor((100 * w * 0.94) / ctx.measureText(masthead).width)));
  while (mastSize > w * 0.1 && issueY + mastSize * 0.86 > ceiling) mastSize -= 4;
  const mastBase = issueY + mastSize * 0.86;
  ctx.fillStyle = MAGAZINE_RED;
  ctx.font = mastFont(mastSize);
  fillText(ctx, masthead, w / 2, mastBase);

  const signOffTop = placeSignOff(ctx, w, h - h * 0.03, text, 0.9, faces);

  // Headline (the concept title) and tagline above the sign-off: smaller, then without the tagline, until clear of faces.
  const low = facesBottom(faces);
  const taglineSize = Math.round(w * 0.03);
  const headFont = (size: number) => `900 ${size}px "${TITLE_FONT}"`;
  let head = { size: 0, lines: [] as string[] };
  let tagline = text.tagline;
  let headTop = signOffTop;
  const measure = () => {
    const height = head.size * 0.8 + (head.lines.length - 1) * head.size * 1.02 + (tagline ? taglineSize * 1.5 : 0);
    headTop = signOffTop - h * 0.02 - height;
  };
  for (const withTagline of [true, false]) {
    tagline = withTagline ? text.tagline : "";
    for (let max = Math.round(w * 0.09); max >= Math.round(w * 0.05); max -= 4) {
      head = fit(ctx, { text: text.title, font: headFont, maxSize: max, minSize: Math.round(w * 0.05), maxLines: 2 }, w * 0.9);
      measure();
      if (headTop >= low) break;
    }
    if (headTop >= low) break;
  }
  // No room below the faces: the headline joins the cover lines, which find a free column.
  const coverLines = headTop >= low ? text.coverLines.slice(0, 3) : [text.title, ...text.coverLines].slice(0, 3);
  if (headTop >= low) {
    ctx.fillStyle = WHITE;
    ctx.font = headFont(head.size);
    const y = drawLines(ctx, head.lines, w / 2, headTop + head.size * 0.8, head.size * 1.02);
    if (tagline) {
      ctx.fillStyle = CLAY;
      ctx.font = `700 ${taglineSize}px "${BODY_FONT}"`;
      fillText(ctx, tagline, w / 2, y - head.size * 1.02 + taglineSize * 1.5);
    }
  }

  // Cover lines only where they cover no one; with no free spot they are left out.
  const colWidth = w * 0.36;
  const spot = coverLines.length ? findCoverSpot(ctx, coverLines, w, h, mastBase + h * 0.03, Math.min(headTop, signOffTop) - h * 0.02, faces, colWidth) : undefined;
  if (spot) {
    ctx.textAlign = spot.align;
    let y = spot.y;
    for (const { block } of coverStack(ctx, coverLines.slice(0, spot.count), w, h, colWidth, spot.scale)) {
      ctx.fillStyle = MAGAZINE_RED;
      ctx.fillRect(spot.align === "right" ? spot.x - w * 0.08 : spot.x, y, w * 0.08, Math.max(4, w * 0.006));
      y += block.size * 1.25;
      ctx.fillStyle = WHITE;
      ctx.font = `900 ${block.size}px "${BODY_FONT}"`;
      y = drawLines(ctx, block.lines, spot.x, y, block.size * 1.12) + h * 0.03;
    }
    ctx.textAlign = "center";
  }
}

/** Player card: frame, art window, rating badge, name plate, stats and the sign-off, all drawn here. */
function drawCard(ctx: SKRSContext2D, img: Img, w: number, h: number, text: PosterText) {
  const m = w * 0.035;
  const gold = ctx.createLinearGradient(0, 0, w, h);
  gold.addColorStop(0, "#F6E3A1");
  gold.addColorStop(0.45, "#C9A042");
  gold.addColorStop(0.55, "#E8CB75");
  gold.addColorStop(1, "#9C7424");
  ctx.fillStyle = "#1C2010";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, w * 0.05);
  ctx.fill();

  // Art window, inset inside the gold frame.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(m, m, w - 2 * m, h - 2 * m, w * 0.035);
  ctx.clip();
  ctx.drawImage(img, m, m, w - 2 * m, h - 2 * m);
  shade(ctx, w, h * 0.5, h, 0, 0.96);
  ctx.restore();
  prepare(ctx);

  // Rating badge, top right as in a real card.
  const r = w * 0.085;
  const bx = w - m - r * 1.25;
  const by = m + r * 1.25;
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2B230C";
  ctx.font = `900 ${Math.round(r * 0.95)}px "${BODY_FONT}"`;
  fillText(ctx, "13", bx, by + r * 0.22);
  ctx.font = `700 ${Math.round(r * 0.26)}px "${BODY_FONT}"`;
  fillText(ctx, POSTER_WORDS[text.lang ?? "he"].badge, bx, by + r * 0.58);
  prepare(ctx);

  // Name plate.
  const cx = w / 2;
  const plateY = h * 0.6;
  const title = fit(ctx, { text: text.title, font: (s) => `900 ${s}px "${TITLE_FONT}"`, maxSize: Math.round(w * 0.085), minSize: 40, maxLines: 1 }, w * 0.8);
  ctx.fillStyle = gold;
  ctx.fillRect(m, plateY - title.size * 0.95, w - 2 * m, title.size * 1.3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2B230C";
  ctx.font = `900 ${title.size}px "${TITLE_FONT}"`;
  fillText(ctx, title.lines[0], cx, plateY);
  prepare(ctx);

  // Stats, 2x2, right column first.
  const stats = text.stats.slice(0, 4);
  const colX = [w * 0.72, w * 0.28];
  const valueSize = Math.round(w * 0.06);
  const labelSize = Math.round(w * 0.03);
  const rowY = plateY + title.size * 0.35 + valueSize * 1.2;
  stats.forEach((st, i) => {
    const x = colX[i % 2];
    const y = rowY + Math.floor(i / 2) * valueSize * 1.75;
    ctx.fillStyle = "#F2D480";
    ctx.font = `900 ${valueSize}px "${BODY_FONT}"`;
    fillText(ctx, String(st.value), x, y);
    ctx.fillStyle = WHITE;
    ctx.font = `500 ${labelSize}px "${BODY_FONT}"`;
    fillText(ctx, st.label, x, y + labelSize * 1.25);
  });
  if (stats.length) {
    ctx.fillStyle = "rgba(242,212,128,0.6)";
    ctx.fillRect(cx - 1, rowY - valueSize, 2, valueSize * 1.75 * Math.ceil(stats.length / 2));
  }

  drawSignOff(ctx, w, h - m - h * 0.022, text, 0.85);
}

/** Album cover: square art with the song title and dedication. */
export async function composeCover(art: Buffer, title: string, byline: string): Promise<Buffer> {
  loadFonts();
  const img = await loadImage(art);
  const size = Math.min(img.width, img.height);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);
  shade(ctx, size, size * 0.62, size, 0, 0.9);
  prepare(ctx);
  const t = fit(ctx, { text: title, font: (s) => `900 ${s}px "${TITLE_FONT}"`, maxSize: Math.round(size * 0.1), minSize: 40, maxLines: 2 }, size * 0.86);
  ctx.fillStyle = ACCENT;
  ctx.font = `900 ${t.size}px "${TITLE_FONT}"`;
  const bylineSize = Math.round(size * 0.035);
  const bottom = size - size * 0.06;
  drawLines(ctx, t.lines, size / 2, bottom - bylineSize * 1.8 - (t.lines.length - 1) * t.size * 1.05, t.size * 1.05);
  ctx.fillStyle = WHITE;
  ctx.font = `500 ${bylineSize}px "${BODY_FONT}"`;
  fillText(ctx, byline, size / 2, bottom);
  return canvas.toBuffer("image/png");
}

/** Closing card of an edited blessing clip: the guest's strongest line, their name and the event. */
export async function composeEndCard(background: Buffer, text: { quote: string; signature: string; footer: string }): Promise<Buffer> {
  loadFonts();
  const bg = await loadImage(background);
  const [w, h] = [bg.width, bg.height];
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bg, 0, 0, w, h);
  ctx.fillStyle = "rgba(24,28,14,0.55)";
  ctx.fillRect(0, 0, w, h);
  prepare(ctx);

  const maxWidth = w * 0.8;
  const quote = text.quote
    ? fit(ctx, { text: isRtlText(text.quote) ? `״${text.quote}״` : `“${text.quote}”`, font: (s) => `700 ${s}px "${TITLE_FONT}"`, maxSize: Math.round(w * 0.075), minSize: 36, maxLines: 6 }, maxWidth)
    : { size: 0, lines: [] as string[] };
  const senderSize = Math.round(w * 0.045);
  const quoteHeight = quote.lines.length * quote.size * 1.2;
  let y = h * 0.46 - quoteHeight / 2 + quote.size;
  ctx.fillStyle = ACCENT;
  ctx.font = `700 ${quote.size}px "${TITLE_FONT}"`;
  y = drawLines(ctx, quote.lines, w / 2, y, quote.size * 1.2);

  ctx.fillStyle = WHITE;
  ctx.font = `500 ${senderSize}px "${BODY_FONT}"`;
  fillText(ctx, text.signature, w / 2, y + senderSize * 1.4);

  ctx.fillStyle = CLAY;
  ctx.font = `700 ${Math.round(w * 0.04)}px "${TITLE_FONT}"`;
  fillText(ctx, text.footer, w / 2, h - h * 0.07);
  return canvas.toBuffer("image/png");
}

/** Opening card of a clip when the guest has no poster: the clip's title and who it is from. */
export async function composeTitleCard(background: Buffer, text: { title: string; from: string; footer: string }): Promise<Buffer> {
  loadFonts();
  const bg = await loadImage(background);
  const [w, h] = [bg.width, bg.height];
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bg, 0, 0, w, h);
  prepare(ctx);
  ctx.fillStyle = CLAY;
  ctx.font = `700 ${Math.round(w * 0.045)}px "${TITLE_FONT}"`;
  fillText(ctx, text.footer, w / 2, h * 0.3);
  const t = fit(ctx, { text: text.title, font: (s) => `900 ${s}px "${TITLE_FONT}"`, maxSize: Math.round(w * 0.13), minSize: 48, maxLines: 3 }, w * 0.84);
  ctx.fillStyle = ACCENT;
  ctx.font = `900 ${t.size}px "${TITLE_FONT}"`;
  const y = drawLines(ctx, t.lines, w / 2, h * 0.5 - ((t.lines.length - 1) * t.size * 1.05) / 2, t.size * 1.05);
  ctx.fillStyle = WHITE;
  ctx.font = `500 ${Math.round(w * 0.045)}px "${BODY_FONT}"`;
  fillText(ctx, text.from, w / 2, y + w * 0.04);
  return canvas.toBuffer("image/png");
}
