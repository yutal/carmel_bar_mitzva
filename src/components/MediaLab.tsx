"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LabJob } from "@/lib/lab/jobs";
import type { Submission } from "@/lib/types";

const fileUrl = (rel: string, download = false) => `/api/admin/file?path=${encodeURIComponent(rel)}${download ? "&download" : ""}`;
const secs = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;
// whisper-1 list price, $0.006 per minute of audio.
const transcribeCost = (seconds: number) => (seconds / 60) * 0.006;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

/** XHR instead of fetch, for an upload progress bar on slow phone connections. */
function upload(url: string, body: FormData, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      try {
        reject(new Error(JSON.parse(xhr.responseText).error));
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("החיבור נפל"));
    xhr.send(body);
  });
}

export default function MediaLab() {
  const [jobs, setJobs] = useState<LabJob[]>([]);
  const [music, setMusic] = useState(false);
  const [posters, setPosters] = useState<Submission[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<{ jobs: LabJob[]; music: boolean }>("/api/admin/lab").catch(() => null);
    if (d) {
      setJobs(d.jobs);
      setMusic(d.music);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
    void api<{ submissions: Submission[] }>("/api/admin/submissions")
      .then((d) => setPosters(d.submissions.filter((s) => s.files.image)))
      .catch(() => undefined);
  }, [load]);

  const busy = jobs.some((j) => j.status === "pending" || j.status === "running");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [busy, load]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">מעבדת וידאו וקול</h1>
          <p className="max-w-2xl text-muted">
            מעלים סרטון או הקלטה של ברכה, ומקבלים בדיוק את מה שאורח יקבל: תמלול, בחירת הקטעים החזקים, כתוביות בעברית ועריכה לקליפ אנכי.
            גלוי רק לך.
          </p>
        </div>
        <a className="btn-ghost" href="/admin">→ חזרה לניהול</a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <NewJob posters={posters} onCreated={load} notify={notify} />
        <MusicCard music={music} setMusic={setMusic} notify={notify} />
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">תוצאות</h2>
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} onDelete={async () => {
            await api(`/api/admin/lab/${j.id}`, { method: "DELETE" });
            await load();
          }} />
        ))}
        {!jobs.length && <p className="text-muted">עוד לא נוצר כאן קליפ.</p>}
      </section>

      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl bg-inverse px-5 py-3 text-canvas shadow-xl">{toast}</div>}
    </main>
  );
}

function NewJob({ posters, onCreated, notify }: { posters: Submission[]; onCreated: () => Promise<void>; notify: (m: string) => void }) {
  const [mode, setMode] = useState<"file" | "record">("file");
  const [file, setFile] = useState<File | null>(null);
  const [guestName, setGuestName] = useState("");
  const [posterId, setPosterId] = useState("");
  const [lang, setLang] = useState<"he" | "en">("he");
  const [progress, setProgress] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return notify("בחר קובץ או הקלט קודם");
    const body = new FormData();
    body.set("file", file);
    body.set("guestName", guestName);
    body.set("posterId", posterId);
    body.set("lang", lang);
    try {
      setProgress(0);
      await upload("/api/admin/lab", body, setProgress);
      notify("הועלה, העיבוד התחיל");
      setFile(null);
      await onCreated();
    } catch (err) {
      notify(`שגיאה: ${err instanceof Error ? err.message : err}`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="font-display text-xl font-bold">ברכה חדשה</h2>
      <div className="flex gap-2">
        <button type="button" className="chip" aria-pressed={mode === "file"} onClick={() => setMode("file")}>🎬 סרטון או קובץ קול</button>
        <button type="button" className="chip" aria-pressed={mode === "record"} onClick={() => setMode("record")}>🎙️ הקלטה כאן</button>
      </div>

      {mode === "file" ? (
        <label className="block space-y-1">
          <span className="text-sm text-muted">מהטלפון אפשר גם לצלם ישר מכאן. עד 5 דקות, עד 200MB.</span>
          <input
            type="file"
            accept="video/*,audio/*"
            className="field"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      ) : (
        <Recorder onRecorded={setFile} notify={notify} />
      )}

      <label className="block space-y-1">
        <span className="text-sm text-muted">שם האורח (יופיע בסוף הקליפ)</span>
        <input className="field" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="למשל: סבתא רותי" />
      </label>
      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">שפת הדיבור</legend>
        <span className="text-sm text-muted">שפת הדיבור:</span>
        <button type="button" className="chip" aria-pressed={lang === "he"} onClick={() => setLang("he")}>עברית</button>
        <button type="button" className="chip" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
      </fieldset>
      <label className="block space-y-1">
        <span className="text-sm text-muted">פוסטר לפתיח (מתוך הברכות שכבר נוצרו)</span>
        <select className="field" value={posterId} onChange={(e) => setPosterId(e.target.value)}>
          <option value="">בלי פוסטר, רקע בצבעי האתר</option>
          {posters.map((s) => (
            <option key={s.id} value={s.id}>{s.input.fullName} · {s.imageConcept?.titleHebrew ?? s.id}</option>
          ))}
        </select>
      </label>

      {file && <p className="text-sm text-muted">נבחר: {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB</p>}
      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-olive-100">
          <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <button className="btn-primary w-full" disabled={!file || progress !== null}>
        {progress !== null ? `מעלה… ${Math.round(progress * 100)}%` : "✦ צור קליפ"}
      </button>
    </form>
  );
}

function Recorder({ onRecorded, notify }: { onRecorded: (f: File | null) => void; notify: (m: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      // Chrome and Android record webm/opus; iPhone Safari only mp4/aac.
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = r.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        onRecorded(new File([blob], `recording${type.includes("mp4") ? ".m4a" : ".webm"}`, { type }));
        setState("done");
      };
      r.start(1000);
      rec.current = r;
      setElapsed(0);
      setState("recording");
      onRecorded(null);
      timer.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    } catch {
      notify("אין גישה למיקרופון. צריך לאשר בדפדפן.");
    }
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (rec.current?.state === "recording") rec.current.stop();
  };

  // Guests will get one minute; stop automatically at the limit.
  useEffect(() => {
    if (state === "recording" && elapsed >= 60) stop();
  }, [state, elapsed]);

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-3">
        {state === "recording" ? (
          <button type="button" className="btn-primary bg-red-700 hover:bg-red-800" onClick={stop}>■ עצור</button>
        ) : (
          <button type="button" className="btn-ghost" onClick={start}>● {state === "done" ? "הקלט מחדש" : "התחל הקלטה"}</button>
        )}
        <span className="tabular-nums text-muted" aria-live="polite">
          {state === "recording" ? `מקליט ${secs(elapsed)} / 1:00` : state === "done" ? `הוקלט ${secs(elapsed)}` : "עד דקה אחת, כמו שאורח יקבל"}
        </span>
      </div>
      {url && state === "done" && <audio controls src={url} className="w-full" />}
    </div>
  );
}

function MusicCard({ music, setMusic, notify }: { music: boolean; setMusic: (v: boolean) => void; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const body = new FormData();
    body.set("file", f);
    setBusy(true);
    try {
      await api("/api/admin/lab/music", { method: "POST", body });
      setMusic(true);
      setVersion((v) => v + 1);
      notify("המוזיקה נשמרה");
    } catch (err) {
      notify(`שגיאה: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-display text-xl font-bold">מוזיקת רקע</h2>
      <p className="text-sm text-muted">
        מתנגנת בפתיח ובסיום, ויורדת אוטומטית כשמדברים. לא חובה. רק מוזיקה שיש לך זכות להשתמש בה, למשל שיר שנוצר ב-Suno בחשבון בתשלום.
      </p>
      {music ? (
        <>
          <audio controls src={`${fileUrl("lab/music.m4a")}&v=${version}`} className="w-full" />
          <div className="flex gap-2">
            <label className="btn-ghost cursor-pointer">
              החלף
              <input type="file" accept="audio/*" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <button type="button" className="btn-ghost" onClick={async () => {
              await api("/api/admin/lab/music", { method: "DELETE" });
              setMusic(false);
            }}>הסר</button>
          </div>
        </>
      ) : (
        <label className="btn-ghost w-full cursor-pointer">
          {busy ? "מעלה…" : "🎵 העלה קובץ מוזיקה"}
          <input type="file" accept="audio/*" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

const STEP_LABEL: Record<string, string> = { probe: "בדיקה", extract: "חילוץ קול", transcribe: "תמלול", plan: "בחירת קטעים", edit: "עריכה" };

function JobCard({ job, onDelete }: { job: LabJob; onDelete: () => Promise<void> }) {
  const kept = (i: number) => {
    const s = job.transcript?.[i];
    return Boolean(s && job.plan?.ranges.some((r) => s.start >= r.start - 0.01 && s.end <= r.end + 0.01));
  };
  const total = Object.values(job.timings).reduce((a, b) => a + b, 0);
  return (
    <article className="card grid gap-5 p-5 md:grid-cols-[minmax(0,260px)_1fr]">
      <div>
        {job.status === "done" && job.clip ? (
          <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-8 border-inverse bg-inverse shadow-xl">
            <video controls playsInline preload="metadata" src={fileUrl(job.clip.file)} className="aspect-[9/16] w-full rounded-[1.4rem] bg-black" />
          </div>
        ) : (
          <div className="flex aspect-[9/16] w-full max-w-[260px] items-center justify-center rounded-[2rem] border border-line bg-olive-100 p-6 text-center">
            {job.status === "failed" ? (
              <p className="text-red-800">נכשל: {job.error}</p>
            ) : (
              <p className="animate-pulse text-muted">{job.step ?? "בתור"}…</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-xl font-bold">{job.plan?.titleHebrew || job.guestName || "ברכה"}</h3>
            <p className="text-sm text-muted">
              {job.guestName && `${job.guestName} · `}
              {job.source ? `${job.source.kind === "video" ? "וידאו" : "הקלטת קול"} ${secs(job.source.duration)}` : "…"}
              {job.clip && ` → קליפ ${secs(job.clip.duration)}`}
              {job.withMusic && " · עם מוזיקה"}
            </p>
          </div>
          <div className="flex gap-2">
            {job.clip && <a className="btn-ghost min-h-9 px-3" href={fileUrl(job.clip.file, true)}>MP4</a>}
            <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => confirm("למחוק את הקליפ?") && onDelete()}>מחק</button>
          </div>
        </div>

        {job.plan?.quoteHebrew && <blockquote className="border-r-4 border-accent-soft pr-3 font-display text-lg">״{job.plan.quoteHebrew}״</blockquote>}

        {job.transcript && (
          <details open={job.status === "done"}>
            <summary className="cursor-pointer text-sm font-medium">תמלול ({job.transcript.length} משפטים · מודגש = נכנס לקליפ)</summary>
            <ol className="mt-2 space-y-1 text-sm">
              {job.transcript.map((s, i) => (
                <li key={i} className={kept(i) ? "font-medium text-ink" : "text-muted/70 line-through decoration-muted/40"}>
                  <span className="tabular-nums text-muted">{secs(s.start)}</span> {s.text}
                </li>
              ))}
            </ol>
          </details>
        )}

        {total > 0 && (
          <p className="text-xs text-muted">
            זמני עיבוד: {Object.entries(job.timings).map(([k, v]) => `${STEP_LABEL[k] ?? k} ${v}ש׳`).join(" · ")} · סה״כ {total.toFixed(1)}ש׳
            {job.source && ` · עלות תמלול כ-$${transcribeCost(job.source.duration).toFixed(3)}`}
          </p>
        )}
      </div>
    </article>
  );
}
