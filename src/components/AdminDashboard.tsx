"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventSettings, StageName, StageStatus, Submission } from "@/lib/types";
import { IMAGE_STYLES } from "@/lib/types";

type Filter = "all" | "failed" | "music" | "hidden" | "marketing";
const STATUS_LABEL: Record<StageStatus, string> = {
  pending: "ממתין",
  running: "רץ",
  done: "מוכן",
  failed: "נכשל",
  awaiting_music: "ממתין להקלטה",
};
const STATUS_COLOR: Record<StageStatus, string> = {
  pending: "bg-olive-100 text-muted",
  running: "bg-blue-500/20 text-blue-200",
  done: "bg-emerald-500/20 text-emerald-200",
  failed: "bg-red-500/15 text-red-800",
  awaiting_music: "bg-olive-100 text-accent",
};
const STAGE_LABEL: Record<StageName, string> = { analysis: "ניתוח", image: "תמונה", song: "שיר" };
const fileUrl = (rel: string, download = false) => `/api/admin/file?path=${encodeURIComponent(rel)}${download ? "&download" : ""}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export default function AdminDashboard() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [queue, setQueue] = useState({ waiting: 0, running: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<{ submissions: Submission[]; queue: typeof queue }>("/api/admin/submissions").catch(() => null);
    if (d) {
      setSubs(d.submissions);
      setQueue(d.queue);
    }
  }, []);

  useEffect(() => {
    // Polling keeps the dashboard live during the event without websockets.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notify(ok);
      await load();
    } catch (err) {
      notify(`שגיאה: ${err instanceof Error ? err.message : err}`);
    }
  };

  const visible = subs.filter((s) => {
    if (filter === "failed") return Object.values(s.stages).some((st) => st?.status === "failed");
    if (filter === "music") return s.stages.song?.status === "awaiting_music";
    if (filter === "hidden") return s.hidden || !s.input.consentScreen;
    if (filter === "marketing") return Boolean(s.input.consentMarketing);
    return true;
  });
  const count = (f: Filter) => (f === "all" ? subs.length : subs.filter((s) => {
    if (f === "failed") return Object.values(s.stages).some((st) => st?.status === "failed");
    if (f === "music") return s.stages.song?.status === "awaiting_music";
    if (f === "marketing") return Boolean(s.input.consentMarketing);
    return s.hidden || !s.input.consentScreen;
  }).length);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">ניהול עמדת הברכות</h1>
          <p className="text-muted">{subs.length} ברכות · בתור: {queue.waiting} · רצות עכשיו: {queue.running}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href="/screen" target="_blank">מסך אולם ↗</a>
          <a className="btn-ghost" href="/admin/lab">🎬 מעבדת וידאו וקול</a>
          <a className="btn-primary" href="/api/admin/export">⬇️ ייצוא אלבום (ZIP)</a>
          <a className="btn-ghost" href="/api/admin/export?marketing=1">⬇️ מאושרים לשיווק (ZIP)</a>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <EventForm onSaved={() => notify("נשמר")} />
        <CelebrantPhotos notify={notify} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "failed", "music", "hidden", "marketing"] as const).map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {{ all: "הכל", failed: "נכשלו", music: "שירים להקלטה", hidden: "מוסתרים מהמסך", marketing: "מאושרים לשיווק" }[f]} ({count(f)})
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <SubmissionCard key={s.id} s={s} run={run} />
          ))}
        </div>
        {!visible.length && <p className="text-muted">אין כאן כלום עדיין.</p>}
      </section>

      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl bg-inverse text-canvas px-5 py-3 shadow-xl">{toast}</div>}
    </main>
  );
}

function SubmissionCard({ s, run }: { s: Submission; run: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const regen = (stage: StageName, newConcept: boolean) =>
    run(
      () => api(`/api/admin/submissions/${encodeURIComponent(s.id)}/regenerate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, newConcept }) }),
      "נשלח ליצירה מחדש",
    );
  const toggleHidden = () =>
    run(
      () => api(`/api/admin/submissions/${encodeURIComponent(s.id)}/visibility`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: !s.hidden }) }),
      s.hidden ? "מוצג במסך" : "הוסתר מהמסך",
    );
  const uploadMp3 = (file: File) => {
    const body = new FormData();
    body.set("mp3", file);
    return run(() => api(`/api/admin/submissions/${encodeURIComponent(s.id)}/song`, { method: "POST", body }), "השיר הועלה");
  };
  const copy = (text: string, what: string) => run(() => navigator.clipboard.writeText(text), `${what} הועתק`);
  const thumb = s.files.image ?? s.files.cover;

  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex gap-3">
        {thumb ? (
          <a href={fileUrl(thumb)} target="_blank" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a generated file */}
            <img src={fileUrl(thumb)} alt="" className="h-28 w-20 rounded-xl object-cover" />
          </a>
        ) : (
          <div className="h-28 w-20 shrink-0 rounded-xl bg-olive-100" />
        )}
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-lg font-bold">{s.input.fullName}</h3>
          <p className="text-sm text-muted">{s.input.relationship} · {new Date(s.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</p>
          <div className="flex flex-wrap gap-1">
            {(Object.entries(s.stages) as [StageName, Submission["stages"]["analysis"]][]).map(([name, st]) => (
              <span key={name} title={st.error} className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[st.status]}`}>
                {STAGE_LABEL[name]}: {STATUS_LABEL[st.status]}
              </span>
            ))}
            {s.input.consentMarketing && <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs text-accent">מאושר לשיווק</span>}
            {(s.hidden || !s.input.consentScreen) && <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs text-muted">לא במסך</span>}
          </div>
        </div>
      </div>

      <p className="line-clamp-3 text-sm text-muted">&quot;{s.input.blessing}&quot;</p>
      <p className="text-xs text-muted">{IMAGE_STYLES[s.input.imageStyle ?? "movie"].icon} {IMAGE_STYLES[s.input.imageStyle ?? "movie"].label}</p>
      {s.imageConcept && <p className="text-sm"><b className="text-accent">{s.imageConcept.titleHebrew}</b> · {s.imageConcept.rationale}</p>}
      {Object.values(s.stages).map((st, i) => st?.error && <p key={i} className="text-xs text-red-700">{st.error}</p>)}

      <div className="flex flex-wrap gap-2 text-sm">
        {s.files.image && <a className="btn-ghost min-h-9 px-3" href={fileUrl(s.files.image, true)}>PNG</a>}
        <a className="btn-ghost min-h-9 px-3" href={fileUrl(`blessings/${s.id}.txt`, true)}>TXT</a>
        {s.files.mp3 && <a className="btn-ghost min-h-9 px-3" href={fileUrl(s.files.mp3, true)}>MP3</a>}
        <button type="button" className="btn-ghost min-h-9 px-3" onClick={toggleHidden}>{s.hidden ? "הצג במסך" : "הסתר"}</button>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-accent">יצירה מחדש</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {s.stages.image && <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => regen("image", false)}>תמונה, אותו רעיון</button>}
          {s.stages.image && <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => regen("image", true)}>תמונה, רעיון חדש</button>}
          {s.stages.song && <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => regen("song", true)}>תיאור שיר חדש</button>}
          <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => regen("analysis", true)}>הכל מההתחלה</button>
        </div>
      </details>

      {s.songConcept && s.stages.song?.status !== "done" && (
        <div className="space-y-2 rounded-2xl bg-olive-100 p-3 text-sm">
          <p className="font-bold text-accent">🎵 {s.songConcept.titleHebrew}</p>
          <p dir="auto" className="rounded-xl bg-surface p-2 text-xs leading-relaxed text-muted">{s.songConcept.sunoPrompt}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-9 px-3 text-sm" onClick={() => copy(s.songConcept!.sunoPrompt, "התיאור")}>העתק תיאור ל־Suno</button>
            <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => copy(s.songConcept!.titleHebrew, "השם")}>העתק שם</button>
            <a className="btn-ghost min-h-9 px-3" href="https://suno.com/create" target="_blank" rel="noreferrer">Suno ↗</a>
          </div>
          <label className="btn-primary min-h-10 w-full cursor-pointer text-base">
            העלאת MP3
            <input type="file" accept="audio/mpeg,.mp3" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadMp3(e.target.files[0])} />
          </label>
        </div>
      )}
    </article>
  );
}

function EventForm({ onSaved }: { onSaved: () => void }) {
  const [ev, setEv] = useState<EventSettings | null>(null);
  useEffect(() => {
    void api<EventSettings>("/api/admin/event").then(setEv);
  }, []);
  if (!ev) return <section className="card p-5" />;
  const field = (key: "celebrantName" | "celebrantNameEn" | "eventTitle" | "eventDate" | "footer" | "footerEn", label: string) => (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      <input className="field py-2.5 text-base" value={ev[key]} onChange={(e) => setEv({ ...ev, [key]: e.target.value })} />
    </label>
  );
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await api("/api/admin/event", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) });
        onSaved();
      }}
    >
      <h2 className="text-xl font-bold">פרטי האירוע</h2>
      {field("celebrantName", "שם החוגג")}
      {field("celebrantNameEn", "שם החוגג באנגלית (לאורחים שבוחרים English)")}
      {field("eventTitle", "כותרת האירוע")}
      {field("eventDate", "תאריך (כפי שיופיע על התמונה)")}
      {field("footer", "שורת תחתית בתמונה")}
      {field("footerEn", "שורת תחתית באנגלית")}
      <label className="flex items-center gap-3">
        <input type="checkbox" className="size-5 accent-accent" checked={ev.songsEnabled} onChange={(e) => setEv({ ...ev, songsEnabled: e.target.checked })} />
        <span>לאפשר לאורחים לבחור שיר (כבוי: רק תמונה)</span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-muted">איך {ev.celebrantName} נראה (נכנס לכל תמונה כדי לשמור על הדמיון)</span>
        <textarea
          className="field py-2.5 text-base"
          rows={3}
          maxLength={1000}
          placeholder="למשל: שיער חום קצר ומתולתל, עיניים חומות, גומות בחיוך, רזה וגבוה לגילו"
          value={ev.celebrantLook}
          onChange={(e) => setEv({ ...ev, celebrantLook: e.target.value })}
        />
      </label>
      <button type="submit" className="btn-primary min-h-11 w-full text-base">שמירה</button>
    </form>
  );
}

function CelebrantPhotos({ notify }: { notify: (m: string) => void }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ photos: string[] }>("/api/admin/celebrant").then((d) => setPhotos(d.photos));
  }, []);
  async function upload(files: FileList) {
    setBusy(true);
    const body = new FormData();
    for (const f of Array.from(files)) body.append("photos", f);
    try {
      setPhotos((await api<{ photos: string[] }>("/api/admin/celebrant", { method: "POST", body })).photos);
      notify("התמונות הועלו");
    } catch (err) {
      notify(`שגיאה: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  }
  async function remove(name: string) {
    setPhotos((await api<{ photos: string[] }>(`/api/admin/celebrant?name=${encodeURIComponent(name)}`, { method: "DELETE" })).photos);
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">תמונות ייחוס של החוגג</h2>
      <p className="text-sm text-muted">4 התמונות הראשונות נשלחות למודל. עדיף פנים ברורות, תאורה טובה וזוויות שונות.</p>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <div key={p} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
            <img src={fileUrl(`celebrant/${p}`)} alt="" className={`aspect-square w-full rounded-xl object-cover ${i >= 4 ? "opacity-40" : ""}`} />
            <button type="button" onClick={() => remove(p)} className="absolute left-1 top-1 rounded-full bg-surface/90 px-2 text-sm" aria-label="מחיקה">✕</button>
          </div>
        ))}
      </div>
      <label className="btn-ghost w-full cursor-pointer">
        {busy ? "מעלה..." : "+ הוספת תמונות"}
        <input type="file" accept="image/*,.heic,.heif" multiple className="sr-only" disabled={busy} onChange={(e) => e.target.files && upload(e.target.files)} />
      </label>
    </section>
  );
}
