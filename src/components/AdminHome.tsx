"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventSummary } from "@/lib/platform/summary";
import type { ToolId, ToolInfo } from "@/lib/platform/tools";

const STATUS_LABEL = { live: "פעיל", soon: "בקרוב", research: "במחקר" } as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export default function AdminHome({ isOwner, name, tools }: { isOwner: boolean; name: string; tools: Record<ToolId, ToolInfo> }) {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => api<{ events: EventSummary[] }>("/api/admin/events").then((d) => setEvents(d.events)).catch(() => setEvents([])), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">שלום {name}</h1>
        <div className="flex gap-2">
          {isOwner && <a className="btn-ghost" href="/admin/accounts">🔑 הרשאות</a>}
          <button className="btn-ghost" onClick={logout}>יציאה</button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">האירועים שלי</h2>
          {isOwner && <button className="btn-primary min-h-11 text-base" onClick={() => setCreating((c) => !c)}>+ אירוע חדש</button>}
        </div>
        {creating && <CreateEvent tools={tools} onDone={() => { setCreating(false); void load(); }} />}
        {events === null && <p className="text-muted">טוען...</p>}
        {events?.length === 0 && <p className="card p-5 text-muted">אין אירועים שנתנו לך גישה אליהם.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {events?.map((e) => (
            <article key={e.slug} className="card space-y-2 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold">{e.title}</h3>
                <span className={`rounded-full px-3 py-1 text-sm ${e.open ? "bg-olive-100 text-accent" : "bg-red-500/15 text-red-800"}`}>{e.open ? "פתוח" : "סגור"}</span>
              </div>
              <p className="text-sm text-muted">
                {e.date || "ללא תאריך"} · {e.mode === "open" ? "אירוע פתוח" : "עם חוגג"} · /e/{e.slug}
              </p>
              {e.reason && <p className="text-sm text-red-800">{e.reason}</p>}
              <p className="text-sm text-muted">
                {e.blessings} ברכות · {e.creations}
                {e.maxCreations ? `/${e.maxCreations}` : ""} יצירות · בתור: {e.queue.waiting + e.queue.running}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a className="btn-primary min-h-10 px-4 text-base" href={`/admin/e/${e.slug}`}>ניהול</a>
                <a className="btn-ghost min-h-10 px-4" href={`/e/${e.slug}`} target="_blank">עמוד אורחים ↗</a>
                <a className="btn-ghost min-h-10 px-4" href={`/e/${e.slug}/screen`} target="_blank">מסך ↗</a>
                {isOwner && <a className="btn-ghost min-h-10 px-4" href={`/admin/e/${e.slug}/license`}>רישיון</a>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">הכלים</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(tools) as [ToolId, ToolInfo][]).map(([id, t]) => (
            <div key={id} className={`card space-y-1 p-4 ${t.status === "live" ? "" : "opacity-70"}`}>
              <p className="text-lg font-bold">{t.icon} {t.name}</p>
              <p className="text-sm text-muted">{t.description}</p>
              <p className="text-xs font-bold text-accent-soft">{STATUS_LABEL[t.status]}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function CreateEvent({ tools, onDone }: { tools: Record<ToolId, ToolInfo>; onDone: () => void }) {
  const [f, setF] = useState({ slug: "", eventTitle: "", celebrantName: "", eventDate: "", mode: "celebrant" as "celebrant" | "open" });
  const [picked, setPicked] = useState<ToolId[]>(["blessings", "screen"]);
  const [error, setError] = useState<string | null>(null);
  const live = (Object.entries(tools) as [ToolId, ToolInfo][]).filter(([, t]) => t.status === "live");

  async function create() {
    setError(null);
    try {
      await api("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, license: { tools: picked, mode: f.mode } }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <input className="field" dir="ltr" placeholder="כתובת באנגלית, למשל cohen-wedding" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} />
      <input className="field" placeholder="שם האירוע" value={f.eventTitle} onChange={(e) => setF({ ...f, eventTitle: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <input className="field" placeholder="שם החוגג (אם יש)" value={f.celebrantName} onChange={(e) => setF({ ...f, celebrantName: e.target.value })} />
        <input className="field" placeholder="תאריך" value={f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} />
      </div>
      <div className="flex gap-2">
        {(["celebrant", "open"] as const).map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={f.mode === m} onClick={() => setF({ ...f, mode: m })}>{m === "open" ? "אירוע פתוח (בלי חוגג)" : "עם חוגג"}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {live.map(([id, t]) => (
          <button key={id} type="button" className="chip" aria-pressed={picked.includes(id)} onClick={() => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}>{t.icon} {t.name}</button>
        ))}
      </div>
      <p className="text-sm text-muted">חלון זמנים, מכסות ותקציב מגדירים אחרי היצירה, במסך הרישיון.</p>
      {error && <p className="text-red-800">{error}</p>}
      <button className="btn-primary min-h-11 text-base" disabled={!f.slug || !f.eventTitle} onClick={create}>יצירת אירוע</button>
    </div>
  );
}
