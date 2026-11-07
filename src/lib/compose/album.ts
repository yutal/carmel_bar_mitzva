import "server-only";
import fs from "node:fs/promises";
import { createCanvas, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import { filePath } from "@/lib/storage/submissions";
import { PRESETS, type Colors, type Theme } from "@/lib/platform/theme-rules";
import type { EventSettings, Submission } from "@/lib/types";
import { BODY_FONT, TITLE_FONT, drawLines, fillText, loadFonts, wrap } from "./poster";

// A4 at 150 dpi: sharp enough for a printed album, small enough to download.
const PAGE_W = 1240;
const PAGE_H = 1754;
const PT_W = 595.28;
const PT_H = 841.89;

/** How the album is laid out. */
export const ALBUM_LAYOUTS = {
  pages: "עמוד לכל אורח: היצירה, השם והברכה המלאה",
  grid: "גלריה: שש יצירות בעמוד, עם שם האורח",
  blessings: "ספר ברכות: טקסט בלבד, כמה ברכות בעמוד",
} as const;
export type AlbumLayout = keyof typeof ALBUM_LAYOUTS;

export type AlbumOptions = {
  layout: AlbumLayout;
  /** Cover title; defaults to the event title. */
  title?: string;
  cover: boolean;
  /** The event's colours; defaults to the ready theme "olive". */
  theme?: Theme;
  /** Open events have no Bar Mitzvah "13" on the cover and no relationship line. */
  open?: boolean;
};

export const DEFAULT_ALBUM: AlbumOptions = { layout: "pages", cover: true };

function colorsOf(theme: Theme | undefined): Colors {
  return { ...PRESETS.olive.colors, ...(theme ? { ...PRESETS[theme.preset]?.colors, ...theme.colors } : {}) } as Colors;
}

/**
 * The printable album: a cover, then one page per guest with their poster (or song cover), the full blessing
 * and their name. Pages are drawn with the same canvas as the posters, so Hebrew and English both come out
 * right, and placed in the PDF as images.
 */
export async function composeAlbum(subs: Submission[], event: EventSettings, options: AlbumOptions = DEFAULT_ALBUM): Promise<Uint8Array> {
  loadFonts();
  const c = colorsOf(options.theme);
  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title || event.eventTitle);
  const add = async (page: Buffer) => {
    const img = await pdf.embedJpg(page);
    pdf.addPage([PT_W, PT_H]).drawImage(img, { x: 0, y: 0, width: PT_W, height: PT_H });
  };
  let n = 0;
  if (options.cover) await add(coverPage(event, subs.length, options, c, ++n));
  if (options.layout === "pages") {
    for (const s of subs) await add(await guestPage(s, event, ++n, c, options));
  } else if (options.layout === "grid") {
    for (let i = 0; i < subs.length; i += GRID_PER_PAGE) await add(await gridPage(subs.slice(i, i + GRID_PER_PAGE), event, ++n, c));
  } else {
    for (let i = 0; i < subs.length; ) {
      const { buffer, used } = blessingsPage(subs.slice(i), event, ++n, c);
      await add(buffer);
      i += used;
    }
  }
  return pdf.save();
}

function page(c: Colors): { canvas: Canvas; ctx: SKRSContext2D } {
  const canvas = createCanvas(PAGE_W, PAGE_H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = c.canvas;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx };
}

function coverPage(event: EventSettings, count: number, o: AlbumOptions, c: Colors, _pageNo: number): Buffer {
  const { canvas, ctx } = page(c);
  const cx = PAGE_W / 2;
  ctx.fillStyle = c.accentSoft;
  ctx.font = `900 520px "${TITLE_FONT}"`;
  // A Bar Mitzvah album opens with the big 13; other events get a star.
  fillText(ctx, o.open ? "★" : "13", cx, 820);
  ctx.fillStyle = c.ink;
  ctx.font = `700 92px "${TITLE_FONT}"`;
  fillText(ctx, o.title || event.eventTitle, cx, 1020);
  ctx.fillStyle = c.highlight;
  ctx.font = `500 44px "${BODY_FONT}"`;
  fillText(ctx, [event.eventDate, `${count} ${o.open ? "יצירות מהאורחים" : "ברכות מהאורחים"}`].filter(Boolean).join(" · "), cx, 1110);
  ctx.fillStyle = c.line;
  ctx.fillRect(cx - 80, 1170, 160, 3);
  return canvas.toBuffer("image/jpeg", 88);
}

const GRID_PER_PAGE = 6;

/** Six creations per page, two columns by three rows, each with the guest's name underneath. */
async function gridPage(subs: Submission[], event: EventSettings, pageNo: number, c: Colors): Promise<Buffer> {
  const { canvas, ctx } = page(c);
  const margin = 80;
  const gap = 40;
  const cellW = (PAGE_W - 2 * margin - gap) / 2;
  const cellH = (PAGE_H - 2 * margin - 100 - 2 * gap) / 3;
  for (const [i, s] of subs.entries()) {
    const x = margin + (i % 2) * (cellW + gap);
    const y = margin + Math.floor(i / 2) * (cellH + gap);
    const label = 70;
    const artFile = s.files.image ?? s.files.cover;
    const art = artFile ? await fs.readFile(filePath(artFile)).then(loadImage, () => undefined) : undefined;
    const boxH = cellH - label;
    if (art) {
      const scale = Math.min(cellW / art.width, boxH / art.height);
      const w = art.width * scale;
      const h = art.height * scale;
      ctx.drawImage(art, x + (cellW - w) / 2, y + (boxH - h) / 2, w, h);
    } else {
      ctx.fillStyle = c.tint;
      ctx.fillRect(x, y, cellW, boxH);
    }
    ctx.fillStyle = c.ink;
    ctx.font = `600 34px "${BODY_FONT}"`;
    fillText(ctx, s.input.fullName, x + cellW / 2, y + boxH + 46);
  }
  footer(ctx, event, pageNo, c);
  return canvas.toBuffer("image/jpeg", 85);
}

/** As many blessings as fit on a page, each with its author; returns how many were used. */
function blessingsPage(subs: Submission[], event: EventSettings, pageNo: number, c: Colors): { buffer: Buffer; used: number } {
  const { canvas, ctx } = page(c);
  const margin = 110;
  const width = PAGE_W - 2 * margin;
  const bottom = PAGE_H - 170;
  let y = margin;
  let used = 0;
  for (const s of subs) {
    if (!s.input.blessing.trim()) {
      used++;
      continue;
    }
    ctx.font = `400 36px "${BODY_FONT}"`;
    const lines = wrap(ctx, `"${s.input.blessing}"`, width);
    const height = lines.length * 54 + 90 + 50;
    if (used && y + height > bottom) break;
    ctx.fillStyle = c.ink;
    ctx.font = `400 36px "${BODY_FONT}"`;
    const after = drawLines(ctx, lines, PAGE_W / 2, y + 36, 54);
    ctx.fillStyle = c.accent;
    ctx.font = `700 32px "${BODY_FONT}"`;
    fillText(ctx, `${s.input.fullName}${s.input.relationship ? ` · ${s.input.relationship}` : ""}`, PAGE_W / 2, after + 56);
    ctx.fillStyle = c.line;
    ctx.fillRect(PAGE_W / 2 - 40, after + 90, 80, 2);
    y += height;
    used++;
  }
  footer(ctx, event, pageNo, c);
  return { buffer: canvas.toBuffer("image/jpeg", 85), used: Math.max(1, used) };
}

function footer(ctx: SKRSContext2D, event: EventSettings, pageNo: number, c: Colors) {
  ctx.fillStyle = c.line;
  ctx.fillRect(PAGE_W / 2 - 60, PAGE_H - 110, 120, 2);
  ctx.fillStyle = c.accentSoft;
  ctx.font = `500 26px "${BODY_FONT}"`;
  fillText(ctx, `${event.footer || event.eventTitle} · ${pageNo}`, PAGE_W / 2, PAGE_H - 66);
}

async function guestPage(s: Submission, event: EventSettings, pageNo: number, c: Colors, o: AlbumOptions): Promise<Buffer> {
  const { canvas, ctx } = page(c);
  const cx = PAGE_W / 2;
  const margin = 100;
  let y = margin;

  const artFile = s.files.image ?? s.files.cover;
  const art = artFile ? await fs.readFile(filePath(artFile)).then(loadImage, () => undefined) : undefined;
  if (art) {
    const maxH = PAGE_H * 0.56;
    const scale = Math.min(maxH / art.height, (PAGE_W - 2 * margin) / art.width);
    const w = art.width * scale;
    const h = art.height * scale;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(art, cx - w / 2, y, w, h);
    ctx.restore();
    y += h + 70;
  } else {
    y = PAGE_H * 0.2;
  }

  // Name, then the relationship.
  ctx.fillStyle = c.ink;
  ctx.font = `700 54px "${BODY_FONT}"`;
  fillText(ctx, s.input.fullName, cx, y + 54);
  ctx.fillStyle = c.muted;
  ctx.font = `400 34px "${BODY_FONT}"`;
  if (!o.open) fillText(ctx, s.input.relationship, cx, y + 104);
  y += 160;

  // The blessing in full: the largest size at which every line fits above the footer.
  const bottom = PAGE_H - 150;
  const width = PAGE_W - 2 * margin - 40;
  let size = art ? 40 : 56;
  let lines: string[] = [];
  for (; size >= 18; size -= 2) {
    ctx.font = `400 ${size}px "${BODY_FONT}"`;
    lines = s.input.blessing.trim() ? wrap(ctx, `"${s.input.blessing}"`, width) : [];
    if (y + lines.length * size * 1.5 <= bottom) break;
  }
  ctx.fillStyle = c.ink;
  ctx.font = `400 ${size}px "${BODY_FONT}"`;
  drawLines(ctx, lines, cx, y + size, size * 1.5);

  footer(ctx, event, pageNo, c);
  return canvas.toBuffer("image/jpeg", 85);
}
