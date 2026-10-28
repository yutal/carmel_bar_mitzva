"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicSubmission } from "@/lib/views";

const ACTIVE = new Set(["pending", "running"]);
const MESSAGES = ["קוראים את הברכה שלך...", "מחפשים את הרגע הכי שלכם...", "כותבים תסריט...", "בוחרים את הסגנון...", "מצלמים את הסצנה...", "מוסיפים את הברכה..."];

export default function ResultView({ publicId }: { publicId: string }) {
  const [data, setData] = useState<(PublicSubmission & { remaining: number | null }) | null>(null);
  const [missing, setMissing] = useState(false);
  const [tick, setTick] = useState(0);

  const busy = !data || Object.values(data.stages).some((s) => s && ACTIVE.has(s));

  useEffect(() => {
    let stop = false;
    async function poll() {
      const res = await fetch(`/api/s/${publicId}`, { cache: "no-store" }).catch(() => null);
      if (stop) return;
      if (res?.status === 404) return setMissing(true);
      if (res?.ok) setData((await res.json()) as PublicSubmission & { remaining: number | null });
    }
    void poll();
    if (!busy) return;
    const t = setInterval(poll, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [publicId, busy]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setTick((n) => n + 1), 3500);
    return () => clearInterval(t);
  }, [busy]);

  if (missing) return <Shell><p className="text-center text-muted">היצירה לא נמצאה.</p></Shell>;
  if (!data) return <Shell><Spinner text="טוען..." /></Shell>;

  const imageFailed = data.stages.image === "failed";
  const songFailed = data.stages.song === "failed";

  return (
    <Shell>
      <p className="text-center text-sm tracking-[0.2em] text-accent-soft">היצירה של {data.fullName}</p>

      {data.stages.image && (
        <section className="mt-5">
          {data.image?.url ? (
            <figure className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated file served by our API */}
              <img src={data.image.url} alt={data.image.title} className="w-full rounded-3xl shadow-2xl shadow-ink/15" />
              <figcaption className="text-center text-muted">{data.image.rationale}</figcaption>
              <Actions url={data.image.url} title={data.image.title} />
            </figure>
          ) : imageFailed ? (
            <Failed what="התמונה" />
          ) : (
            <Spinner text={MESSAGES[tick % MESSAGES.length]} sub="תמונה לוקחת בערך דקה. אפשר לסגור ולחזור לקישור הזה." />
          )}
        </section>
      )}

      {data.stages.song && (
        <section className="card mt-8 p-5">
          {data.song ? (
            <>
              <div className="flex items-center gap-4">
                {data.song.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- generated file served by our API
                  <img src={data.song.coverUrl} alt="" className="size-24 rounded-2xl object-cover" />
                )}
                <div>
                  <p className="text-sm text-accent-soft">שיר מאת {data.fullName}</p>
                  <h2 className="font-display text-2xl font-bold text-ink">{data.song.title}</h2>
                </div>
              </div>
              {data.song.audioUrl ? (
                <audio controls src={data.song.audioUrl} className="mt-4 w-full" />
              ) : (
                <p className="mt-4 rounded-2xl bg-olive-100 p-3 text-accent">🎵 השיר שלך בהפקה. הוא יגיע לקישור הזה ולאלבום של בר המצווה אחרי האירוע.</p>
              )}
            </>
          ) : songFailed ? (
            <Failed what="השיר" />
          ) : (
            <div className="flex items-center gap-3" role="status">
              <span className="size-8 animate-spin rounded-full border-4 border-line border-t-accent" />
              <p className="text-lg font-bold">מכינים את השיר...</p>
            </div>
          )}
        </section>
      )}

      <blockquote className="mt-8 border-r-2 border-accent-soft pr-4 text-muted">
        <p className="whitespace-pre-wrap">&quot;{data.blessing}&quot;</p>
        <footer className="mt-2 text-sm">{data.fullName}, {data.relationship}</footer>
      </blockquote>

      <div className="mt-8 grid gap-3">
        {data.remaining === 0 ? (
          <p className="text-center text-sm text-muted">יצרת את כל היצירות האפשריות. תודה שבירכת!</p>
        ) : (
          <Link href={`/?again=1&name=${encodeURIComponent(data.fullName)}&rel=${encodeURIComponent(data.relationship)}`} className="btn-primary w-full">
            ✦ יצירה נוספת{data.remaining === 1 ? " (נשארה עוד אחת)" : data.remaining !== null && ` (נשארו עוד ${data.remaining})`}
          </Link>
        )}
        <Link href="/" className="btn-ghost w-full">לעמוד הבית</Link>
      </div>
    </Shell>
  );
}

function Actions({ url, title }: { url: string; title: string }) {
  async function share() {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "poster.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title });
      await navigator.share({ url: location.href, title });
    } catch {
      // The user closed the share sheet, or sharing is unsupported; download is still there.
    }
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <a href={`${url}?download`} className="btn-primary">⬇️ הורדה</a>
      <button type="button" className="btn-ghost" onClick={share}>📤 שיתוף</button>
    </div>
  );
}

function Spinner({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center" role="status">
      <span className="size-14 animate-spin rounded-full border-4 border-line border-t-accent" />
      <p className="text-xl font-bold">{text}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}

function Failed({ what }: { what: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-lg">משהו לא הסתדר עם {what} 😕</p>
      <p className="mt-1 text-sm text-muted">הצוות יקבל התראה וינסה שוב. הברכה שלך נשמרה.</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh w-full max-w-md px-5 py-8">{children}</main>;
}
