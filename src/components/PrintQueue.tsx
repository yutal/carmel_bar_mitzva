"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrintItem } from "@/lib/print/queue";

type Data = { profiles: Record<string, string>; items: PrintItem[]; eligible: { id: string; name: string; number: number | null }[] };

const STATUS = { queued: "ממתין להדפסה", printed: "הודפס", skipped: "דולג" } as const;

export default function PrintQueue({ slug }: { slug: string }) {
  const base = `/api/admin/e/${slug}/print`;
  const [data, setData] = useState<Data | null>(null);
  const [profile, setProfile] = useState("magnet_5x7");
  const [copies, setCopies] = useState(1);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(base, { cache: "no-store" });
    const d = (await res.json()) as Data & { error?: string };
    if (!res.ok) return setError(d.error ?? "שגיאה");
    setData(d);
  }, [base]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (url: string, init: RequestInit) => {
    setError(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "שגיאה");
    await load();
  };

  if (!data) return <main className="p-8">{error ?? "טוען..."}</main>;
  const queuedIn = (p: string) => data.items.filter((i) => i.profile === p && i.status === "queued");
  const queuedProfiles = [...new Set(data.items.filter((i) => i.status === "queued").map((i) => i.profile))];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8">
      <a className="text-muted" href={`/admin/e/${slug}`}>→ חזרה לאירוע</a>
      <h1 className="font-display text-3xl font-bold">תור הדפסה</h1>
      {error && <p role="alert" className="text-red-800">{error}</p>}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">הוספה לתור</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select className="field !w-auto" value={profile} onChange={(e) => setProfile(e.target.value)}>
            {Object.entries(data.profiles).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <label className="flex items-center gap-2">עותקים <input className="field !w-20 !py-2" type="number" min={1} max={20} value={copies} onChange={(e) => setCopies(Number(e.target.value) || 1)} /></label>
        </div>
        <div className="max-h-56 space-y-1 overflow-auto">
          {data.eligible.map((s) => (
            <label key={s.id} className="flex items-center gap-2">
              <input type="checkbox" checked={pick.has(s.id)} onChange={() => setPick((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} />
              {s.number ? `#${s.number} · ` : ""}{s.name}
            </label>
          ))}
          {!data.eligible.length && <p className="text-muted">אין עדיין יצירות מוכנות.</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary min-h-11 text-base" disabled={!pick.size} onClick={async () => { await send(base, { method: "POST", body: JSON.stringify({ submissionIds: [...pick], profile, copies }) }); setPick(new Set()); }}>הוספה לתור ({pick.size})</button>
          <button className="btn-ghost min-h-11" onClick={() => setPick(new Set(data.eligible.map((s) => s.id)))}>בחירת הכל</button>
        </div>
      </section>

      {queuedProfiles.map((p) => (
        <a key={p} className="btn-ghost w-full" href={`${base}/sheet?profile=${p}`} target="_blank">
          🖨️ גיליונות A4 עם סימני חיתוך: {data.profiles[p]} ({queuedIn(p).reduce((n, i) => n + i.copies, 0)} הדפסות)
        </a>
      ))}

      <ul className="card divide-y divide-line">
        {data.items.slice().reverse().map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <span>
              <b className="tabular-nums">#{String(i.serial).padStart(4, "0")}</b> {i.guestName} · {data.profiles[i.profile]} × {i.copies}
              <span className="ms-2 text-sm text-muted">{STATUS[i.status]}</span>
            </span>
            <span className="flex gap-2">
              <a className="btn-ghost min-h-9 px-3" href={`${base}/${i.id}/file`}>קובץ JPG</a>
              {i.status === "queued" && <button className="btn-ghost min-h-9 px-3" onClick={() => send(`${base}/${i.id}`, { method: "PATCH", body: JSON.stringify({ status: "printed" }) })}>הודפס</button>}
              {i.status === "queued" && <button className="btn-ghost min-h-9 px-3" onClick={() => send(`${base}/${i.id}`, { method: "PATCH", body: JSON.stringify({ status: "skipped" }) })}>דלג</button>}
              <button className="btn-ghost min-h-9 px-3" onClick={() => send(`${base}/${i.id}`, { method: "DELETE" })}>הסר</button>
            </span>
          </li>
        ))}
        {!data.items.length && <li className="p-4 text-muted">התור ריק.</li>}
      </ul>
    </main>
  );
}
