import "server-only";
import fs from "node:fs/promises";
import { createCanvas, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import { filePath } from "@/lib/storage/submissions";
import type { EventSettings, Submission } from "@/lib/types";
import { BODY_FONT, TITLE_FONT, drawLines, fillText, loadFonts, wrap } from "./poster";

// A4 at 150 dpi: sharp enough for a printed album, small enough to download.
const PAGE_W = 1240;
const PAGE_H = 1754;
const PT_W = 595.28;
const PT_H = 841.89;
const CANVAS = "#f6f6ee";
const INK = "#2d331c";
const MUTED = "#6b7350";
const ACCENT_SOFT = "#9aa46a";
const CLAY = "#d9875e";
const LINE = "#dce0bf";

/**
 * The printable album: a cover, then one page per guest with their poster (or song cover), the full blessing
 * and their name. Pages are drawn with the same canvas as the posters, so Hebrew and English both come out
 * right, and placed in the PDF as images.
 */
export async function composeAlbum(subs: Submission[], event: EventSettings): Promise<Uint8Array> {
  loadFonts();
  const pdf = await PDFDocument.create();
  pdf.setTitle(event.eventTitle);
  const add = async (page: Buffer) => {
    const img = await pdf.embedJpg(page);
    pdf.addPage([PT_W, PT_H]).drawImage(img, { x: 0, y: 0, width: PT_W, height: PT_H });
  };
  await add(coverPage(event, subs.length));
  let n = 1;
  for (const s of subs) await add(await guestPage(s, event, ++n));
  return pdf.save();
}

function page(): { canvas: Canvas; ctx: SKRSContext2D } {
  const canvas = createCanvas(PAGE_W, PAGE_H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CANVAS;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx };
}

function coverPage(event: EventSettings, count: number): Buffer {
  const { canvas, ctx } = page();
  const cx = PAGE_W / 2;
  ctx.fillStyle = ACCENT_SOFT;
  ctx.font = `900 520px "${TITLE_FONT}"`;
  fillText(ctx, "13", cx, 820);
  ctx.fillStyle = INK;
  ctx.font = `700 92px "${TITLE_FONT}"`;
  fillText(ctx, event.eventTitle, cx, 1020);
  ctx.fillStyle = CLAY;
  ctx.font = `500 44px "${BODY_FONT}"`;
  fillText(ctx, [event.eventDate, `${count} ברכות מהאורחים`].filter(Boolean).join(" · "), cx, 1110);
  ctx.fillStyle = LINE;
  ctx.fillRect(cx - 80, 1170, 160, 3);
  return canvas.toBuffer("image/jpeg", 88);
}

async function guestPage(s: Submission, event: EventSettings, pageNo: number): Promise<Buffer> {
  const { canvas, ctx } = page();
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
    ctx.shadowColor = "rgba(45,51,28,0.25)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(art, cx - w / 2, y, w, h);
    ctx.restore();
    y += h + 70;
  } else {
    y = PAGE_H * 0.2;
  }

  // Name, then the relationship.
  ctx.fillStyle = INK;
  ctx.font = `700 54px "${BODY_FONT}"`;
  fillText(ctx, s.input.fullName, cx, y + 54);
  ctx.fillStyle = MUTED;
  ctx.font = `400 34px "${BODY_FONT}"`;
  fillText(ctx, s.input.relationship, cx, y + 104);
  y += 160;

  // The blessing in full: the largest size at which every line fits above the footer.
  const bottom = PAGE_H - 150;
  const width = PAGE_W - 2 * margin - 40;
  let size = art ? 40 : 56;
  let lines: string[] = [];
  for (; size >= 18; size -= 2) {
    ctx.font = `400 ${size}px "${BODY_FONT}"`;
    lines = wrap(ctx, `"${s.input.blessing}"`, width);
    if (y + lines.length * size * 1.5 <= bottom) break;
  }
  ctx.fillStyle = INK;
  ctx.font = `400 ${size}px "${BODY_FONT}"`;
  drawLines(ctx, lines, cx, y + size, size * 1.5);

  // Footer: the event, the page number.
  ctx.fillStyle = LINE;
  ctx.fillRect(cx - 60, PAGE_H - 110, 120, 2);
  ctx.fillStyle = ACCENT_SOFT;
  ctx.font = `500 26px "${BODY_FONT}"`;
  fillText(ctx, `${event.footer} · ${pageNo}`, cx, PAGE_H - 66);
  return canvas.toBuffer("image/jpeg", 85);
}
