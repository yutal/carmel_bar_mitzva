import fs from "node:fs/promises";
import os from "node:os";
import { getHeapStatistics } from "node:v8";
import { config } from "@/lib/config";
import { ffmpegAvailable } from "@/lib/media/ffmpeg";
import { queueStats } from "@/lib/pipeline/queue";
import { forEachEvent } from "@/lib/platform/events";
import { listCelebrantPhotos } from "@/lib/storage/event";
import { listSubmissions } from "@/lib/storage/submissions";

/** Totals across all events: no names, slugs or guest data on this public endpoint. */
async function counts() {
  const c = { events: 0, submissions: 0, celebrantPhotos: 0 };
  await forEachEvent(async () => {
    c.events++;
    c.submissions += (await listSubmissions()).length;
    c.celebrantPhotos += (await listCelebrantPhotos()).length;
  });
  return c;
}

const MB = 1024 * 1024;

/** Whether DATA_DIR is its own mount (a persistent disk) rather than the container's throwaway filesystem. */
async function isMountPoint(dir: string): Promise<boolean> {
  const mounts = await fs.readFile("/proc/mounts", "utf8").catch(() => "");
  return mounts.split("\n").some((line) => line.split(" ")[1] === dir);
}

async function containerMemoryLimit(): Promise<number | null> {
  const raw = await fs.readFile("/sys/fs/cgroup/memory.max", "utf8").catch(() => "max");
  const n = Number(raw.trim());
  return Number.isFinite(n) ? Math.round(n / MB) : null;
}

async function canWrite(dir: string): Promise<boolean> {
  const probe = `${dir}/.health-${process.pid}`;
  try {
    await fs.writeFile(probe, "ok");
    await fs.rm(probe);
    return true;
  } catch {
    return false;
  }
}

/** Public, anonymous health check: storage, memory and queue. No guest data. */
export async function GET() {
  const [persistent, writable, stats, memLimit, totals, ffmpeg] = await Promise.all([
    isMountPoint(config.dataDir),
    canWrite(config.dataDir),
    fs.statfs(config.dataDir),
    containerMemoryLimit(),
    counts(),
    ffmpegAvailable(),
  ]);
  return Response.json(
    {
      ok: writable,
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
      uptimeMinutes: Math.round(process.uptime() / 60),
      storage: {
        dataDir: config.dataDir,
        persistentDisk: persistent,
        writable,
        freeMB: Math.round((stats.bavail * stats.bsize) / MB),
        totalMB: Math.round((stats.blocks * stats.bsize) / MB),
      },
      server: {
        cpus: os.availableParallelism(),
        memoryLimitMB: memLimit,
        rssMB: Math.round(process.memoryUsage().rss / MB),
        heapLimitMB: Math.round(getHeapStatistics().heap_size_limit / MB),
      },
      generation: { concurrency: config.concurrency, ...queueStats("all") },
      videoLab: { ffmpeg },
      counts: totals,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
