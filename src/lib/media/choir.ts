import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { config } from "@/lib/config";
import { composeEndCard, composeTitleCard } from "@/lib/compose/poster";
import type { TranscriptWord } from "@/lib/types";
import { AUDIO_FMT, assTime, backdrop, framed, FPS, H, isName, W } from "./clip";
import { run, type MediaInfo } from "./ffmpeg";

const INTRO = 2.5;
const OUTRO = 3.5;
const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"];

const letters = (w: string) => w.replace(/[^\p{L}]/gu, "").toLowerCase();

/**
 * Where the speaker says "mazal tov" (Hebrew or English spelling), extended over the celebrant's name
 * when it follows, as in "mazal tov Carmel". Null when the phrase is not in the recording.
 */
export function findMazalTov(words: TranscriptWord[], names: string[]): { start: number; end: number } | null {
  for (let i = 0; i + 1 < words.length; i++) {
    const a = letters(words[i].word);
    const b = letters(words[i + 1].word);
    const hebrew = a.endsWith("מזל") && b.startsWith("טוב");
    const english = /^maz+[ae]l$/.test(a) && b.startsWith("tov");
    if (!hebrew && !english) continue;
    let last = i + 1;
    if (words[last + 1] && isName(words[last + 1].word, names) && words[last + 1].start - words[last].end < 0.6) last++;
    return { start: words[i].start, end: words[last].end };
  }
  return null;
}

export type ChoirItem = { input: string; info: MediaInfo; start: number; end: number; name: string; poster?: Buffer };

function assDoc(events: string[]): string {
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Name,Heebo,46,&H00FFFFFF,&H00FFFFFF,&H00141C18,&H90000000,-1,0,0,0,100,100,0,0,1,3,2,8,40,40,90,-1",
    "Style: Big,Heebo,88,&H004AD5FF,&H004AD5FF,&H00141C18,&H90000000,-1,0,0,0,100,100,0,0,1,5,3,5,40,40,0,-1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

const nameLabel = (name: string, seconds: number) =>
  assDoc([`Dialogue: 0,${assTime(0)},${assTime(seconds)},Name,,0,0,0,,{\\fad(80,0)}‏${name.replace(/[{}\\\n]/g, "")}‏`]);

/** One guest saying the phrase, as a vertical segment with their name on top. */
async function renderSnippet(dir: string, i: number, item: ChoirItem, pad: { before: number; after: number }): Promise<{ file: string; seconds: number; still: string }> {
  const start = Math.max(0, item.start - pad.before);
  const end = Math.min(item.info.duration, item.end + pad.after);
  const seconds = end - start;
  const ass = `name${i}.ass`;
  await fs.writeFile(path.join(dir, ass), nameLabel(item.name, seconds));
  const out = `seg${i}.mp4`;
  const still = `still${i}.png`;
  const audio = `[0:a]${AUDIO_FMT},atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5,${AUDIO_FMT},afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, seconds - 0.08).toFixed(3)}:d=0.08${item.info.video ? "[a]" : ",asplit[a][aw]"}`;
  let video: string;
  const inputs = ["-i", item.input];
  if (item.info.video) {
    const portrait = item.info.video.width / item.info.video.height < 0.7;
    const cut = `[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS}`;
    video = portrait
      ? `${cut},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[base]`
      : `${cut},split[fa][fb];[fa]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2,eq=brightness=-0.12[bg];[fb]scale=${W}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[base]`;
  } else {
    // Voice only: the guest's poster (or the site colours) with their waveform.
    const small = await backdrop(item.poster, W, H);
    const bg = item.poster ? await framed(small, item.poster, { w: 600, h: 880, top: 170 }) : small;
    await fs.writeFile(path.join(dir, `bg${i}.png`), bg);
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", seconds.toFixed(3), "-i", `bg${i}.png`);
    video = `[aw]showwaves=s=600x140:mode=cline:rate=${FPS}:colors=0xFFD54A:scale=sqrt,format=rgba[w];[1:v]scale=${W}:${H},setsar=1[pb];[pb][w]overlay=(W-w)/2:1080:shortest=1,setsar=1[base]`;
  }
  const f = [audio, video, `[base]subtitles=${ass}:fontsdir=${config.fontsDir},format=yuv420p[v]`].join(";");
  await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", f, "-map", "[v]", "-map", "[a]", ...ENC, "-t", seconds.toFixed(3), out], { cwd: dir, timeoutMs: 120_000 });
  // A frame from the middle, for the closing mosaic.
  await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", (seconds / 2).toFixed(3), "-i", out, "-frames:v", "1", still], { cwd: dir, timeoutMs: 30_000 });
  return { file: out, seconds, still };
}

/** Every guest's face in one grid, for the finale when all the voices sound together. */
async function mosaic(dir: string, stills: string[]): Promise<Buffer> {
  const n = stills.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * W) / H)));
  const rows = Math.ceil(n / cols);
  const cw = Math.floor(W / cols);
  const ch = Math.floor(H / rows);
  const tiles = await Promise.all(
    stills.map(async (s, i) => ({
      input: await sharp(path.join(dir, s)).resize(cw - 4, ch - 4, { fit: "cover" }).png().toBuffer(),
      left: (i % cols) * cw + 2 + Math.floor((W - cols * cw) / 2),
      top: Math.floor(i / cols) * ch + 2 + Math.floor((H - rows * ch) / 2),
    })),
  );
  return sharp({ create: { width: W, height: H, channels: 3, background: "#141c18" } }).composite(tiles).png().toBuffer();
}

/**
 * The "mazal tov choir": every guest saying "mazal tov" in turn, faster and faster, then all of them together
 * over a mosaic of their faces, and a closing card. Made from the lab's recordings and their word times.
 */
export async function buildChoir(req: {
  dir: string;
  items: ChoirItem[];
  celebrant: string;
  footer: string;
  lang: "he" | "en";
  poster?: Buffer;
  music?: string;
}): Promise<{ file: string; duration: number }> {
  const { dir, items } = req;
  const en = req.lang === "en";
  await fs.mkdir(dir, { recursive: true });

  const snippets = [];
  for (const [i, item] of items.entries()) {
    // The first voices get room to breathe; later ones are cut tighter, so the pace picks up.
    const t = items.length > 1 ? i / (items.length - 1) : 0;
    snippets.push(await renderSnippet(dir, i, item, { before: 0.25 - 0.17 * t, after: 0.35 - 0.3 * t }));
  }

  const bg = await backdrop(req.poster, 1080, 1920);
  const n = items.length;
  await fs.writeFile(path.join(dir, "intro.png"), await composeTitleCard(bg, {
    title: en ? "The mazal tov choir" : "מקהלת מזל טוב",
    from: en ? `${n} guests, one wish` : `${n} אורחים, ברכה אחת`,
    footer: req.footer,
  }));
  await fs.writeFile(path.join(dir, "end.png"), await composeEndCard(bg, {
    quote: en ? `Mazal tov, ${req.celebrant}!` : `מזל טוב ${req.celebrant}!`,
    signature: en ? `From all ${n} of us` : `מכל ${n} האורחים`,
    footer: req.footer,
  }));
  await fs.writeFile(path.join(dir, "mosaic.png"), await mosaic(dir, snippets.map((s) => s.still)));

  const still = (png: string, seconds: number, out: string, zoom: boolean) =>
    run("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-loop", "1", "-framerate", String(FPS), "-t", seconds.toFixed(3), "-i", png,
      "-f", "lavfi", "-t", seconds.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo",
      "-filter_complex", zoom
        ? `[0:v]zoompan=z='1+0.05*on/${Math.round(seconds * FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(seconds * FPS)}:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v]`
        : `[0:v]scale=${W}:${H},setsar=1,format=yuv420p,fade=in:d=0.4[v]`,
      "-map", "[v]", "-map", "1:a", ...ENC, "-t", seconds.toFixed(3), out,
    ], { cwd: dir, timeoutMs: 60_000 });
  await still("intro.png", INTRO, "intro.mp4", true);
  await still("end.png", OUTRO, "end.mp4", false);

  // Finale: every voice at once, each a few hundredths of a second after the last, like a crowd shouting together.
  const stagger = Math.min(0.08, 1.2 / Math.max(1, n));
  const finale = Math.max(3, Math.max(...snippets.map((s) => s.seconds)) + stagger * n + 0.8);
  const fin: string[] = ["-loop", "1", "-framerate", String(FPS), "-t", finale.toFixed(3), "-i", "mosaic.png"];
  for (const s of snippets) fin.push("-i", s.file);
  const mix = snippets.map((_, i) => `[${i + 1}:a]${AUDIO_FMT},adelay=${Math.round(i * stagger * 1000)}:all=1[m${i}]`);
  const bigText = en ? `Mazal tov, ${req.celebrant}!` : `‏מזל טוב ${req.celebrant}!‏`;
  await fs.writeFile(path.join(dir, "finale.ass"), assDoc([
    `Dialogue: 0,${assTime(0.3)},${assTime(finale)},Big,,0,0,0,,{\\fad(250,0)\\fscx60\\fscy60\\t(0,350,\\fscx100\\fscy100)}${bigText.replace(/[{}\\]/g, "")}`,
  ]));
  await run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", ...fin,
    "-filter_complex", [
      ...mix,
      `${snippets.map((_, i) => `[m${i}]`).join("")}amix=inputs=${n}:normalize=0:duration=longest,alimiter=limit=0.9,${AUDIO_FMT},apad[a]`,
      `[0:v]zoompan=z='1+0.08*on/${Math.round(finale * FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(finale * FPS)}:s=${W}x${H}:fps=${FPS},setsar=1,subtitles=finale.ass:fontsdir=${config.fontsDir},format=yuv420p[v]`,
    ].join(";"),
    "-map", "[v]", "-map", "[a]", ...ENC, "-t", finale.toFixed(3), "finale.mp4",
  ], { cwd: dir, timeoutMs: 180_000 });

  const parts = ["intro.mp4", ...snippets.map((s) => s.file), "finale.mp4", "end.mp4"];
  await fs.writeFile(path.join(dir, "parts.txt"), parts.map((p) => `file '${p}'`).join("\n"));
  const duration = INTRO + snippets.reduce((t, s) => t + s.seconds, 0) + finale + OUTRO;
  const out = "choir.mp4";
  const concat = ["-f", "concat", "-safe", "0", "-i", "parts.txt"];
  if (req.music) {
    // Music under the whole piece, ducked whenever someone speaks.
    await run("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error", ...concat, "-stream_loop", "-1", "-i", req.music,
      "-filter_complex", [
        `[0:a]${AUDIO_FMT},asplit[v1][key]`,
        `[1:a]${AUDIO_FMT},atrim=0:${duration.toFixed(3)},volume=0.35,afade=t=in:d=1,afade=t=out:st=${(duration - 2).toFixed(3)}:d=2[music]`,
        `[music][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=350[ducked]`,
        `[v1][ducked]amix=inputs=2:normalize=0:duration=first[a]`,
      ].join(";"),
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
    ], { cwd: dir, timeoutMs: 180_000 });
  } else {
    await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...concat, "-c", "copy", "-movflags", "+faststart", out], { cwd: dir, timeoutMs: 120_000 });
  }
  // Intermediate files are only needed while building.
  await Promise.all(
    (await fs.readdir(dir)).filter((f) => f !== out && f !== "choir.json").map((f) => fs.rm(path.join(dir, f), { force: true })),
  );
  return { file: path.join(dir, out), duration };
}
