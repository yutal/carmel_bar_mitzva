"use client";

import { useCallback, useEffect, useState } from "react";
import type { PhotoCase, QaCase, QaRun } from "@/lib/qa/check";
import { IMAGE_STYLES, type ImageStyle } from "@/lib/types";

const STYLES = Object.keys(IMAGE_STYLES) as ImageStyle[];
const PHOTO_LABEL: Record<PhotoCase, string> = { none: "בלי תמונה", single: "אדם אחד", group: "קבוצה" };
const fileUrl = (rel: string) => `/api/admin/file?path=${encodeURIComponent(rel)}`;
// Used until the status panel knows the real average cost of a poster.
const FALLBACK_CASE_USD = 0.3;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export default function QaPanel() {
  const [run, setRun] = useState<QaRun | null>(null);
  const [styles, setStyles] = useState<ImageStyle[]>(STYLES);
  const [langs, setLangs] = useState<string[]>(["he", "en"]);
  const [single, setSingle] = useState<File | null>(null);
  const [group, setGroup] = useState<File | null>(null);
  const [perCase, setPerCase] = useState(FALLBACK_CASE_USD);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const d = await api<{ run: QaRun | null }>("/api/admin/qa").catch(() => null);
    if (d) setRun(d.run);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
    void api<{ spend: { perPosterUsd: number | null } }>("/api/admin/status")
      .then((d) => d.spend.perPosterUsd && setPerCase(d.spend.perPosterUsd + 0.02))
      .catch(() => undefined);
  }, [load]);
  const running = run?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const photos = 1 + (single ? 1 : 0) + (group ? 1 : 0);
  const total = styles.length * langs.length * photos;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const start = async () => {
    if (!confirm(`להריץ ${total} יצירות אמיתיות? עלות משוערת $${(total * perCase).toFixed(2)}.`)) return;
    const body = new FormData();
    body.set("styles", styles.join(","));
    body.set("langs", langs.join(","));
    if (single) body.set("single", single);
    if (group) body.set("group", group);
    setSending(true);
    setError(null);
    try {
      setRun((await api<{ run: QaRun }>("/api/admin/qa", { method: "POST", body })).run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const done = run?.cases.filter((c) => c.status === "done" || c.status === "failed") ?? [];
  const passed = done.filter((c) => c.pass).length;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">בדיקת סגנונות</h1>
          <p className="max-w-2xl text-muted">
            יוצרת פוסטרים אמיתיים לכל סגנון, שפה ומקרה תמונה, בדיוק כמו לאורח, ומודל שני סופר בכל אחד כמה אנשים יש, כמה פעמים כרמל מופיע,
            אם נוספו דמויות ואם הסגנון נכון. עולה כסף, רצה רק כשלוחצים.
          </p>
        </div>
        <a className="btn-ghost" href="/admin">→ חזרה לניהול</a>
      </header>

      <section className="card space-y-4 p-5">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted">סגנונות</legend>
          {STYLES.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={styles.includes(s)} onClick={() => setStyles(toggle(styles, s))}>
              {IMAGE_STYLES[s].icon} {IMAGE_STYLES[s].label}
            </button>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted">שפות</legend>
          <button type="button" className="chip" aria-pressed={langs.includes("he")} onClick={() => setLangs(toggle(langs, "he"))}>עברית</button>
          <button type="button" className="chip" aria-pressed={langs.includes("en")} onClick={() => setLangs(toggle(langs, "en"))}>English</button>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm text-muted">תמונה של אדם אחד (לא כרמל)</span>
            <input type="file" accept="image/*" className="field" onChange={(e) => setSingle(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">תמונה קבוצתית (2-4 אנשים, אפשר גם סלפי עם כרמל)</span>
            <input type="file" accept="image/*" className="field" onChange={(e) => setGroup(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <p className="text-sm text-muted">
          מקרה &quot;בלי תמונה&quot; תמיד נכלל. סה״כ {total} יצירות, עלות משוערת ${(total * perCase).toFixed(2)}.
        </p>
        {error && <p className="text-red-800">{error}</p>}
        <button type="button" className="btn-primary" disabled={running || sending || !total} onClick={start}>
          {running ? "בדיקה רצה…" : "✦ הרץ בדיקה"}
        </button>
      </section>

      {run && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">
            {run.status === "done" ? (passed === run.cases.length ? "✅ הכל תקין" : `⚠️ ${passed} מתוך ${run.cases.length} תקינים`) : `רץ… ${done.length} מתוך ${run.cases.length}`}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {run.cases.map((c) => <CaseCard key={c.key} c={c} />)}
          </div>
        </section>
      )}
    </main>
  );
}

function CaseCard({ c }: { c: QaCase }) {
  const tone = c.status === "failed" || c.pass === false ? "border-red-700" : c.pass ? "border-accent" : "border-line";
  return (
    <article className={`card overflow-hidden border-2 ${tone}`}>
      {c.poster ? (
        <a href={fileUrl(c.poster)} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated file served by our API */}
          <img src={fileUrl(c.poster)} alt="" className="aspect-[2/3] w-full object-cover" />
        </a>
      ) : (
        <div className="flex aspect-[2/3] items-center justify-center bg-olive-100 text-muted">
          {c.status === "running" ? <span className="animate-pulse">יוצר…</span> : c.status === "failed" ? "נכשל" : "בתור"}
        </div>
      )}
      <div className="space-y-1 p-3 text-sm">
        <p className="font-bold">
          {c.pass ? "✅" : c.status === "done" || c.status === "failed" ? "❌" : "⏳"} {IMAGE_STYLES[c.style].label} · {c.lang === "en" ? "EN" : "עב"} · {PHOTO_LABEL[c.photo]}
        </p>
        {c.check && (
          <p className="text-xs text-muted">
            {c.check.peopleCount} אנשים (צריך {c.expected}) · כרמל ×{c.check.celebrantCopies}
            {c.repainted ? " · צויר פעמיים" : ""}
          </p>
        )}
        {c.problems?.map((p) => <p key={p} className="text-xs text-red-800">{p}</p>)}
        {c.check?.notes && !c.pass && <p className="text-xs text-muted">{c.check.notes}</p>}
        {c.error && <p className="text-xs text-red-800">{c.error}</p>}
      </div>
    </article>
  );
}
