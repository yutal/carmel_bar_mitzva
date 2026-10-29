import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { config } from "@/lib/config";
import { composeEndCard, composeTitleCard } from "@/lib/compose/poster";
import { isRtlText, type Lang } from "@/lib/i18n";
import type { TranscriptSegment } from "@/lib/types";
import { run, type MediaInfo } from "./ffmpeg";

// Vertical 720p: what phones play full screen, and light enough for a 1-CPU server.
const W = 720;
const H = 1280;
const FPS = 30;
const INTRO = 3;
const OUTRO = 3;

export type ClipRange = { start: number; end: number };

export type ClipRequest = {
  /** Working folder; the clip and its intermediate files are written here. */
  dir: string;
  input: string;
  info: MediaInfo;
  /** Parts of the source to keep, in seconds, in order. */
  ranges: ClipRange[];
  segments: TranscriptSegment[];
  poster?: Buffer;
  /** Shown on the opening card when there is no poster. */
  title: string;
  quote: string;
  sender: string;
  footer: string;
  lang: Lang;
  /** Background music, ducked under speech. */
  music?: string;
};

/** Poster blurred to fill the frame, or the site's olive gradient when there is no poster. */
async function backdrop(poster: Buffer | undefined, w: number, h: number): Promise<Buffer> {
  if (!poster) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d331c"/><stop offset="1" stop-color="#5e6a3a"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
  return sharp(poster).resize(w, h, { fit: "cover" }).blur(40).modulate({ brightness: 0.55 }).png().toBuffer();
}

async function framed(bg: Buffer, poster: Buffer | undefined, box: { w: number; h: number; top?: number }): Promise<Buffer> {
  if (!poster) return bg;
  const fg = await sharp(poster).resize(box.w, box.h, { fit: "inside" }).png().toBuffer();
  const meta = await sharp(fg).metadata();
  const { width = 0, height = 0 } = await sharp(bg).metadata();
  const top = box.top ?? Math.round((height - meta.height!) / 2);
  return sharp(bg).composite([{ input: fg, left: Math.round((width - meta.width!) / 2), top }]).png().toBuffer();
}

function assTime(t: number): string {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

/** Splits a spoken line into short captions, each timed by its share of the characters. */
function captions(text: string, start: number, end: number, maxChars = 34): { start: number; end: number; text: string }[] {
  const chunks: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      chunks.push(line);
      line = word;
    } else line = next;
  }
  if (line) chunks.push(line);
  const total = chunks.reduce((n, c) => n + c.length, 0) || 1;
  let t = start;
  return chunks.map((c) => {
    const d = ((end - start) * c.length) / total;
    const cue = { start: t, end: t + d, text: c };
    t += d;
    return cue;
  });
}

/**
 * Hebrew subtitles on the clip's own timeline. libass + fribidi lay them out right to left;
 * Encoding -1 asks libass for the Unicode base direction (RTL here) instead of forcing LTR.
 */
function subtitles(req: ClipRequest, marginV: number): string {
  const events: string[] = [];
  let offset = INTRO;
  for (const r of req.ranges) {
    for (const seg of req.segments) {
      const s = Math.max(seg.start, r.start);
      const e = Math.min(seg.end, r.end);
      if (e - s < 0.2) continue;
      for (const cue of captions(seg.text, offset + s - r.start, offset + e - r.start)) {
        const clean = cue.text.replace(/[{}\\]/g, "").replace(/\n/g, " ");
        // RLM on both ends keeps leading/trailing punctuation on the right side of Hebrew, even on older libass.
        const text = isRtlText(clean) ? `\u200F${clean}\u200F` : clean;
        events.push(`Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Main,,0,0,0,,${text}`);
      }
    }
    offset += r.end - r.start;
  }
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Main,Heebo,50,&H00FFFFFF,&H00FFFFFF,&H00141C18,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,50,50,${marginV},-1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

const AUDIO_FMT = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
const silence = (seconds: number, label: string) => `anullsrc=r=48000:cl=stereo,atrim=0:${seconds.toFixed(3)},aformat=sample_fmts=fltp[${label}]`;

/**
 * Edits a guest's video or voice recording into a vertical clip:
 * poster intro with a slow push-in, the chosen spoken parts with Hebrew captions, and a closing card.
 */
export async function buildClip(req: ClipRequest): Promise<{ file: string; duration: number }> {
  const isVideo = Boolean(req.info.video);
  const body = req.ranges.reduce((n, r) => n + (r.end - r.start), 0);
  const total = INTRO + body + OUTRO;

  const bg = await backdrop(req.poster, 1080, 1920);
  const en = req.lang === "en";
  const card = { title: req.title || (en ? "From the heart" : "ברכה מכל הלב"), from: en ? `From ${req.sender}` : `מאת ${req.sender}`, footer: req.footer };
  const intro = req.poster ? await framed(bg, req.poster, { w: 940, h: 1670 }) : await composeTitleCard(bg, card);
  await fs.writeFile(path.join(req.dir, "intro.png"), intro);
  await fs.writeFile(path.join(req.dir, "end.png"), await composeEndCard(bg, { quote: req.quote, signature: en ? `With love, ${req.sender}` : `באהבה, ${req.sender}`, footer: req.footer }));
  if (!isVideo) {
    const small = await backdrop(req.poster, W, H);
    const audioBg = req.poster ? await framed(small, req.poster, { w: 600, h: 880, top: 70 }) : await composeTitleCard(small, card);
    await fs.writeFile(path.join(req.dir, "audio-bg.png"), audioBg);
  }
  // Voice-only: captions sit under the waveform; video: above the phone's lower edge.
  await fs.writeFile(path.join(req.dir, "subs.ass"), subtitles(req, isVideo ? 210 : 120));

  const inputs = ["-i", req.input, "-i", "intro.png", "-loop", "1", "-framerate", String(FPS), "-t", String(OUTRO), "-i", "end.png"];
  let next = 3;
  const bgInput = isVideo ? -1 : next++;
  if (!isVideo) inputs.push("-loop", "1", "-framerate", String(FPS), "-t", body.toFixed(3), "-i", "audio-bg.png");
  const musicInput = req.music ? next++ : -1;
  if (req.music) inputs.push("-stream_loop", "-1", "-i", req.music);

  const f: string[] = [];
  f.push(`[1:v]zoompan=z='1+0.06*on/${INTRO * FPS}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${INTRO * FPS}:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p,fade=out:st=${INTRO - 0.3}:d=0.3[vi]`);
  f.push(silence(INTRO, "ai"));
  f.push(`[2:v]scale=${W}:${H},setsar=1,format=yuv420p,fade=in:st=0:d=0.4[ve]`);
  f.push(silence(OUTRO, "ae"));

  const n = req.ranges.length;
  const parts: string[] = [];
  if (req.info.hasAudio) f.push(`[0:a]${AUDIO_FMT},asplit=${n}${req.ranges.map((_, i) => `[sa${i}]`).join("")}`);
  req.ranges.forEach((r, i) => {
    const len = r.end - r.start;
    if (req.info.hasAudio) {
      f.push(`[sa${i}]atrim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, len - 0.15).toFixed(3)}:d=0.15[a${i}]`);
    } else f.push(silence(len, `a${i}`));
  });

  if (isVideo) {
    const { width, height } = req.info.video!;
    const portrait = width / height < 0.7;
    f.push(`[0:v]split=${n}${req.ranges.map((_, i) => `[sv${i}]`).join("")}`);
    req.ranges.forEach((r, i) => {
      const cut = `[sv${i}]trim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS}`;
      if (portrait) {
        f.push(`${cut},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,format=yuv420p[v${i}]`);
      } else {
        // Landscape or square: the full frame over a blurred copy of itself, nothing cropped away.
        f.push(`${cut},split[fa${i}][fb${i}]`);
        f.push(`[fa${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2,eq=brightness=-0.12[bg${i}]`);
        f.push(`[fb${i}]scale=${W}:-2[fg${i}]`);
        f.push(`[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v${i}]`);
      }
      parts.push(`[v${i}][a${i}]`);
    });
    f.push(`[vi][ai]${parts.join("")}[ve][ae]concat=n=${n + 2}:v=1:a=1[vcat][acat]`);
  } else {
    // Voice only: poster with a live waveform of the guest's voice.
    f.push(`${req.ranges.map((_, i) => `[a${i}]`).join("")}concat=n=${n}:v=0:a=1,asplit[ab][aw]`);
    f.push(`[aw]showwaves=s=600x120:mode=cline:rate=${FPS}:colors=0xE4E9C6:scale=sqrt,format=rgba[waves]`);
    f.push(`[${bgInput}:v]scale=${W}:${H},setsar=1[abg]`);
    f.push(`[abg][waves]overlay=(W-w)/2:975:shortest=1,setsar=1,format=yuv420p[vb]`);
    f.push(`[vi][ai][vb][ab][ve][ae]concat=n=3:v=1:a=1[vcat][acat]`);
  }

  f.push(`[vcat]subtitles=subs.ass:fontsdir=${config.fontsDir}[vout]`);
  // Phone recordings vary wildly in level; bring every clip to the same loudness.
  f.push(`[acat]loudnorm=I=-16:TP=-1.5:LRA=11,${AUDIO_FMT}[voice]`);
  if (musicInput >= 0) {
    f.push(`[${musicInput}:a]${AUDIO_FMT},atrim=0:${total.toFixed(3)},volume=0.3,afade=t=in:d=1,afade=t=out:st=${(total - 2).toFixed(3)}:d=2[music]`);
    f.push(`[voice]asplit[v1][key]`);
    f.push(`[music][key]sidechaincompress=threshold=0.02:ratio=12:attack=20:release=450[ducked]`);
    f.push(`[v1][ducked]amix=inputs=2:normalize=0:duration=first[aout]`);
  } else f.push(`[voice]anull[aout]`);

  const out = "clip.mp4";
  await run(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error",
      ...inputs,
      "-filter_complex", f.join(";"),
      "-map", "[vout]", "-map", "[aout]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k",
      "-t", total.toFixed(3),
      "-movflags", "+faststart",
      out,
    ],
    { cwd: req.dir, timeoutMs: 10 * 60_000 },
  );
  return { file: path.join(req.dir, out), duration: total };
}
