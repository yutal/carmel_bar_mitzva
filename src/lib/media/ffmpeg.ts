import "server-only";
import { spawn } from "node:child_process";

/** Runs ffmpeg/ffprobe and returns stdout; rejects with the tail of stderr. */
export function run(bin: "ffmpeg" | "ffprobe", args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs ?? 5 * 60_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject((e as NodeJS.ErrnoException).code === "ENOENT" ? new Error(`${bin} is not installed`) : e);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${bin} failed (${signal ?? code}): ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

export type MediaInfo = {
  duration: number;
  /** Display size, after the phone's rotation flag is applied. Absent for audio-only files. */
  video?: { width: number; height: number };
  hasAudio: boolean;
};

type ProbeStream = {
  codec_type: string;
  width?: number;
  height?: number;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
  disposition?: { attached_pic?: number };
};

export async function probe(file: string): Promise<MediaInfo> {
  const json = JSON.parse(
    await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { timeoutMs: 30_000 }),
  ) as { format?: { duration?: string }; streams?: ProbeStream[] };
  const streams = json.streams ?? [];
  // Cover art inside an m4a/mp3 shows up as a one-frame video stream.
  const v = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic && s.width && s.height);
  let video: MediaInfo["video"];
  if (v) {
    const rotation = Math.abs(Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0));
    video = rotation % 180 === 90 ? { width: v.height!, height: v.width! } : { width: v.width!, height: v.height! };
  }
  return {
    duration: Number(json.format?.duration ?? 0),
    video,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
  };
}

export async function ffmpegAvailable(): Promise<boolean> {
  return run("ffmpeg", ["-version"], { timeoutMs: 10_000 }).then(() => true, () => false);
}
