"use client";

import { useEffect, useState } from "react";
import { LANG_INFO, STRINGS, type Lang } from "@/lib/i18n";
import type { PublicSubmission } from "@/lib/views";

const ACTIVE = new Set(["pending", "running"]);
type T = (typeof STRINGS)[Lang];

export default function ResultView({ publicId, initialLang = "he" }: { publicId: string; initialLang?: Lang }) {
  const [data, setData] = useState<PublicSubmission | null>(null);
  const [missing, setMissing] = useState(false);
  const [thanks, setThanks] = useState(false);

  const lang = data?.lang ?? initialLang;
  const t = STRINGS[lang];
  const busy = !data || Object.values(data.stages).some((s) => s && ACTIVE.has(s));

  useEffect(() => {
    let stop = false;
    async function poll() {
      const res = await fetch(`/api/s/${publicId}`, { cache: "no-store" }).catch(() => null);
      if (stop) return;
      if (res?.status === 404) return setMissing(true);
      if (res?.ok) setData((await res.json()) as PublicSubmission);
    }
    void poll();
    if (!busy) return;
    const timer = setInterval(poll, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [publicId, busy]);

  if (missing) return <Shell lang={lang}><p className="text-center text-muted">{t.notFound}</p></Shell>;
  if (!data) return <Shell lang={lang}><Spinner title={t.loading} /></Shell>;
  if (thanks) return <Shell lang={lang}><Thanks t={t} lang={lang} guest={data.fullName} onScreen={data.onScreen} /></Shell>;

  const imageFailed = data.stages.image === "failed";
  const songFailed = data.stages.song === "failed";
  const blessingOnly = !data.stages.image && !data.stages.song;

  return (
    <Shell lang={lang}>
      <p className="text-center text-sm tracking-[0.2em] text-accent-soft">{t.creationOf(data.fullName)}</p>
      {data.number && !data.queue && <p className="mt-1 text-center text-xs font-bold tabular-nums text-muted">{t.ticket(data.number)}</p>}

      {blessingOnly && <h1 className="mt-4 text-center font-display text-3xl font-bold text-ink">{t.blessingSaved}</h1>}

      {data.stages.image && (
        <section className="mt-5">
          {data.image?.url ? (
            <figure className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated file served by our API */}
              <img src={data.image.url} alt={data.image.title} className="w-full rounded-3xl shadow-2xl shadow-ink/15" />
              <figcaption dir="auto" className="text-center text-muted">{data.image.rationale}</figcaption>
              <Actions url={data.image.url} title={data.image.title} t={t} />
            </figure>
          ) : imageFailed ? (
            <Failed text={t.failed("image")} hint={t.failedHint} />
          ) : (
            <Progress data={data} t={t} />
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
                  <p className="text-sm text-accent-soft">{t.songBy(data.fullName)}</p>
                  <h2 className="font-display text-2xl font-bold text-ink">{data.song.title}</h2>
                </div>
              </div>
              {data.song.audioUrl ? (
                <audio controls src={data.song.audioUrl} className="mt-4 w-full" />
              ) : (
                <p className="mt-4 rounded-2xl bg-olive-100 p-3 text-accent">{t.songInProduction}</p>
              )}
            </>
          ) : songFailed ? (
            <Failed text={t.failed("song")} hint={t.failedHint} />
          ) : (
            <div className="flex items-center gap-3" role="status">
              <span className="size-8 animate-spin rounded-full border-4 border-line border-t-accent" />
              <p className="text-lg font-bold">{t.preparingSong}</p>
            </div>
          )}
        </section>
      )}

      <blockquote className="mt-8 border-s-2 border-accent-soft ps-4 text-muted">
        <p dir="auto" className="whitespace-pre-wrap">&quot;{data.blessing}&quot;</p>
        <footer className="mt-2 text-sm">{data.fullName}, {data.relationship}</footer>
      </blockquote>

      {/* One calm way out once the creation is ready: a thank-you, not a push to make another. Hidden while it is
          being made, so nobody leaves halfway thinking they stopped it. The creation limit is stated on the welcome screen. */}
      {!busy && (
        <button type="button" className="btn-ghost mt-8 w-full" onClick={() => setThanks(true)}>
          {t.finish}
        </button>
      )}
    </Shell>
  );
}

/**
 * While the poster is made: the guest's place in line and a rough time while waiting, then which step is
 * under way. A wait that is explained and has a visible end feels shorter, so guests stay or come back.
 */
function Progress({ data, t }: { data: PublicSubmission; t: T }) {
  const steps = ["story", "painting", "finishing"] as const;
  const current = data.queue ? -1 : steps.indexOf(data.phase ?? "story");
  return (
    <div className="card space-y-5 px-6 py-8 text-center" role="status" aria-live="polite">
      <span className="mx-auto block size-14 animate-spin rounded-full border-4 border-line border-t-accent" />
      {data.queue ? (
        <div>
          {data.number && <p className="mb-2 font-display text-4xl font-black tabular-nums text-accent">#{data.number}</p>}
          <p className="text-xl font-bold">{t.queueAhead(data.queue.ahead)}</p>
          <p className="mt-1 text-muted">{t.eta(data.queue.etaSeconds)}</p>
        </div>
      ) : (
        <p className="text-xl font-bold">{t.phases[steps[current]]}...</p>
      )}
      <ol className="flex justify-center gap-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${i < current ? "bg-olive-100 text-accent" : i === current ? "bg-accent text-canvas" : "bg-olive-100/50 text-muted"}`}>
            {i < current ? "✓ " : ""}
            {t.phases[s]}
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">{t.imageWait}</p>
    </div>
  );
}

function Actions({ url, title, t }: { url: string; title: string; t: T }) {
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  // Fetched ahead: the share sheet only opens straight from a tap, so nothing may be awaited before it.
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => r.blob())
      .then((b) => alive && setFile(new File([b], "poster.png", { type: b.type || "image/png" })))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url]);

  function share() {
    const link = location.href;
    if (navigator.share) {
      const withFile = file && navigator.canShare?.({ files: [file] });
      const payload = withFile ? { files: [file], title, text: `${t.shareText}: ${link}` } : { title, text: t.shareText, url: link };
      // Closing the share sheet rejects the promise; there is nothing to do then.
      navigator.share(payload).catch(() => undefined);
      return;
    }
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <a href={`${url}?download`} className="btn-primary">{t.download}</a>
      <button type="button" className="btn-ghost" onClick={share}>{copied ? t.linkCopied : t.share}</button>
    </div>
  );
}

/** The last screen: thanks, where the creation goes, and a way to close. */
function Thanks({ t, lang, guest, onScreen }: { t: T; lang: Lang; guest: string; onScreen: boolean }) {
  const [closeFailed, setCloseFailed] = useState(false);
  return (
    <section className="flex min-h-[80dvh] flex-col items-center justify-center gap-5 text-center">
      <p className="text-6xl" aria-hidden>💛</p>
      <h1 className="font-display text-4xl font-bold text-ink">{t.thanksTitle(guest)}</h1>
      <p className="text-lg leading-relaxed text-muted">{t.thanksBody(onScreen)}</p>
      <button
        type="button"
        className="btn-primary mt-4 w-full"
        onClick={() => {
          // Browsers only let a page close a tab that a script opened; a tab opened from a QR code stays open.
          window.close();
          setTimeout(() => setCloseFailed(true), 300);
        }}
      >
        {t.close}
      </button>
      {closeFailed && <p className="text-muted">{t.closeHint}</p>}
      {/* A full page load, so the form starts empty. */}
      <a href={lang === "he" ? "/" : `/?lang=${lang}`} className="text-sm text-muted underline underline-offset-4">
        {t.backHome}
      </a>
    </section>
  );
}

function Spinner({ title }: { title: string }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center" role="status">
      <span className="size-14 animate-spin rounded-full border-4 border-line border-t-accent" />
      <p className="text-xl font-bold">{title}</p>
    </div>
  );
}

function Failed({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-lg">{text}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

function Shell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <main dir={LANG_INFO[lang].dir} lang={lang} className="mx-auto min-h-dvh w-full max-w-md px-5 py-8">
      {children}
    </main>
  );
}
