"use client";

import { useEffect, useState } from "react";
import type { License } from "@/lib/platform/license-rules";
import type { ToolId, ToolInfo } from "@/lib/platform/tools";

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time. */
const toLocal = (iso: string | null) => (iso ? new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export default function LicensePanel({ slug, tools }: { slug: string; tools: Record<ToolId, ToolInfo> }) {
  const [lic, setLic] = useState<License | null>(null);
  const [used, setUsed] = useState<{ creations: number; spentUsd?: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const url = `/api/admin/e/${slug}/license`;

  useEffect(() => {
    void fetch(url, { cache: "no-store" }).then((r) => r.json()).then((d: { license: License; usage: { creations: number; spentUsd?: number } }) => {
      setLic(d.license);
      setUsed(d.usage);
    });
  }, [url]);
  if (!lic) return <main className="p-8">טוען...</main>;
  const set = <K extends keyof License>(k: K, v: License[K]) => setLic({ ...lic, [k]: v });

  async function save() {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lic) });
    const d = (await res.json()) as { error?: string };
    setMsg(res.ok ? "הרישיון נשמר" : (d.error ?? "שגיאה"));
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-5 py-8">
      <a className="text-muted" href="/admin">→ חזרה</a>
      <h1 className="font-display text-3xl font-bold">רישיון האירוע /{slug}</h1>
      <p className="text-sm text-muted">הרישיון נשמר חתום בשרת. רק בעל הפלטפורמה יכול לשנות אותו, ושינוי ידני בקובץ סוגר את האירוע.</p>
      {used && <p className="card p-4">יצירות עד כה: {used.creations}{used.spentUsd !== undefined && ` · הוצאת AI: $${used.spentUsd.toFixed(2)}`}</p>}

      <fieldset className="space-y-2">
        <legend className="mb-2 font-bold">כלים כלולים</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(tools) as [ToolId, ToolInfo][]).filter(([, t]) => t.status === "live").map(([id, t]) => (
            <button key={id} type="button" className="chip" aria-pressed={lic.tools.includes(id)} onClick={() => set("tools", lic.tools.includes(id) ? lic.tools.filter((x) => x !== id) : [...lic.tools, id])}>{t.icon} {t.name}</button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        {(["celebrant", "open"] as const).map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={lic.mode === m} onClick={() => set("mode", m)}>{m === "open" ? "אירוע פתוח" : "עם חוגג"}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="text-muted">התחלה</span><input className="field" type="datetime-local" value={toLocal(lic.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} /></label>
        <label className="space-y-1"><span className="text-muted">סיום</span><input className="field" type="datetime-local" value={toLocal(lic.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} /></label>
        <label className="space-y-1"><span className="text-muted">מכסת יצירות (0 = ללא הגבלה)</span><input className="field" type="number" min={0} value={lic.maxCreations} onChange={(e) => set("maxCreations", Number(e.target.value) || 0)} /></label>
        <label className="space-y-1"><span className="text-muted">תקציב AI בדולרים (0 = ללא הגבלה)</span><input className="field" type="number" min={0} value={lic.budgetUsd} onChange={(e) => set("budgetUsd", Number(e.target.value) || 0)} /></label>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={lic.customTheme} onChange={(e) => set("customTheme", e.target.checked)} /> התאמת עיצוב אישית (צבעים ולוגו)</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={lic.suspended} onChange={(e) => set("suspended", e.target.checked)} /> השהיית האירוע (סוגר מיד את כל הכלים)</label>
      <label className="block space-y-1"><span className="text-muted">הערה פנימית (לקוח, מחיר, חשבונית)</span><textarea className="field" rows={2} maxLength={500} value={lic.note} onChange={(e) => set("note", e.target.value)} /></label>
      {msg && <p role="status" className="text-accent">{msg}</p>}
      <button className="btn-primary w-full" onClick={save}>שמירה</button>
    </main>
  );
}
