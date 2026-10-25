import "server-only";
import path from "node:path";
import { GlobalFonts, createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { config } from "@/lib/config";

const ACCENT = "#E4E9C6"; // pale olive, readable on the dark band
const CLAY = "#E9A27E";
const WHITE = "#FFFFFF";
const TITLE_FONT = "Frank Ruhl Libre";
const BODY_FONT = "Heebo";

let fontsLoaded = false;
function loadFonts() {
  if (fontsLoaded) return;
  GlobalFonts.registerFromPath(path.join(config.fontsDir, "FrankRuhlLibre.ttf"), TITLE_FONT);
  GlobalFonts.registerFromPath(path.join(config.fontsDir, "Heebo.ttf"), BODY_FONT);
  fontsLoaded = true;
}

type TextBlock = { text: string; font: (size: number) => string; maxSize: number; minSize: number; maxLines: number };

function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
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

function drawLines(ctx: SKRSContext2D, lines: string[], x: number, y: number, lineHeight: number): number {
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
  title: string;
  tagline: string;
  blessing: string;
  sender: string;
  footer: string;
};

/** Final poster: generated art + Hebrew title, original blessing and sender, rendered here (not by the model). */
export async function composePoster(art: Buffer, text: PosterText): Promise<Buffer> {
  loadFonts();
  const img = await loadImage(art);
  const w = img.width;
  const h = img.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const cx = w / 2;
  const textWidth = w * 0.86;
  shade(ctx, w, 0, h * 0.24, 0.75, 0);
  shade(ctx, w, h * 0.55, h, 0, 0.92);
  prepare(ctx);

  // Title + tagline at the top.
  const title = fit(ctx, { text: text.title, font: (s) => `900 ${s}px "${TITLE_FONT}"`, maxSize: Math.round(w * 0.11), minSize: 48, maxLines: 2 }, textWidth);
  ctx.fillStyle = ACCENT;
  ctx.font = `900 ${title.size}px "${TITLE_FONT}"`;
  const y = drawLines(ctx, title.lines, cx, h * 0.035 + title.size, title.size * 1.05);
  if (text.tagline) {
    ctx.fillStyle = WHITE;
    ctx.font = `500 ${Math.round(w * 0.032)}px "${BODY_FONT}"`;
    drawLines(ctx, [text.tagline], cx, y + w * 0.025, 0);
  }

  // Footer, then sender, then the blessing stacked upwards from the bottom.
  const footerSize = Math.round(w * 0.026);
  const footerY = h - h * 0.03;
  ctx.fillStyle = ACCENT;
  ctx.font = `500 ${footerSize}px "${BODY_FONT}"`;
  ctx.fillText(text.footer, cx, footerY);
  ctx.fillRect(cx - w * 0.12, footerY - footerSize * 1.6, w * 0.24, 2);

  const senderSize = Math.round(w * 0.034);
  const senderY = footerY - footerSize * 3;
  ctx.fillStyle = CLAY;
  ctx.font = `700 ${senderSize}px "${BODY_FONT}"`;
  ctx.fillText(text.sender, cx, senderY);

  const blessing = fit(
    ctx,
    { text: `"${text.blessing}"`, font: (s) => `400 ${s}px "${BODY_FONT}"`, maxSize: Math.round(w * 0.044), minSize: 24, maxLines: 7 },
    textWidth,
  );
  const lh = blessing.size * 1.38;
  ctx.fillStyle = WHITE;
  ctx.font = `400 ${blessing.size}px "${BODY_FONT}"`;
  drawLines(ctx, blessing.lines, cx, senderY - senderSize * 1.6 - (blessing.lines.length - 1) * lh, lh);

  return canvas.toBuffer("image/png");
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
  ctx.fillText(byline, size / 2, bottom);
  return canvas.toBuffer("image/png");
}
