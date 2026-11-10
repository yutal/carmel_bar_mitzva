"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountView } from "@/lib/platform/accounts";
import type { EventSummary } from "@/lib/platform/summary";
import type { AuditEntry } from "@/lib/platform/audit";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export default function AccountsPanel({ roles }: { roles: Record<string, string> }) {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ username: "", name: "" });

  const load = useCallback(async () => {
    const [a, e, l] = await Promise.all([
      api<{ accounts: AccountView[] }>("/api/admin/accounts"),
      api<{ events: EventSummary[] }>("/api/admin/events"),
      api<{ entries: AuditEntry[] }>("/api/admin/audit"),
    ]);
    setAccounts(a.accounts);
    setEvents(e.events);
    setAudit(l.entries.slice(0, 40));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      const r = (await fn()) as { password?: string } | undefined;
      if (r?.password) setSecret(r.password);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    }
  };
  const patch = (id: string, body: object) => run(() => api(`/api/admin/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8">
      <a className="text-muted" href="/admin">→ חזרה</a>
      <h1 className="font-display text-3xl font-bold">הרשאות</h1>
      <p className="text-sm text-muted">מפעיל רואה רק את האירועים שנתת לו, לפי התפקיד. הוא לא רואה מפתחות, פרומפטים, עלויות או רישיון, ולא יכול לשנות אותם. הסיסמה מוצגת פעם אחת בלבד.</p>
      {secret && <p className="card p-4 font-mono" dir="ltr">הסיסמה החדשה: {secret}</p>}
      {error && <p className="text-red-800">{error}</p>}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">מפעיל חדש</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field" dir="ltr" placeholder="שם משתמש" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
          <input className="field" placeholder="שם מלא" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <button className="btn-primary min-h-11 text-base" disabled={!draft.username || !draft.name} onClick={() => run(async () => { const r = await api("/api/admin/accounts", { method: "POST", body: JSON.stringify(draft) }); setDraft({ username: "", name: "" }); return r; })}>יצירה</button>
      </section>

      {accounts.map((a) => (
        <section key={a.id} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{a.name} <span className="font-normal text-muted" dir="ltr">({a.username})</span> {a.disabled && <span className="text-red-800">· מושבת</span>}</p>
            <div className="flex gap-2">
              <button className="btn-ghost min-h-9 px-3" onClick={() => patch(a.id, { resetPassword: true })}>סיסמה חדשה</button>
              <button className="btn-ghost min-h-9 px-3" onClick={() => patch(a.id, { disabled: !a.disabled })}>{a.disabled ? "הפעלה" : "השבתה"}</button>
              <button className="btn-ghost min-h-9 px-3" onClick={() => confirm(`למחוק את ${a.name}?`) && run(() => api(`/api/admin/accounts/${a.id}`, { method: "DELETE" }))}>מחיקה</button>
            </div>
          </div>
          <div className="space-y-2">
            {events.map((e) => (
              <label key={e.slug} className="flex items-center justify-between gap-3">
                <span>{e.title} <span className="text-sm text-muted" dir="ltr">/{e.slug}</span></span>
                <select className="field !w-auto !py-2" value={a.events[e.slug] ?? ""} onChange={(ev) => {
                  const next = { ...a.events };
                  if (ev.target.value) next[e.slug] = ev.target.value as never;
                  else delete next[e.slug];
                  void patch(a.id, { events: next });
                }}>
                  <option value="">אין גישה</option>
                  {Object.entries(roles).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="font-bold">יומן פעולות</h2>
        <ul className="card divide-y divide-line text-sm">
          {audit.map((l, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 px-4 py-2" dir="ltr">
              <span className="text-muted">{new Date(l.at).toLocaleString("he-IL")}</span>
              <span className="font-bold">{l.action}</span>
              <span>{l.actor}</span>
              {l.event && <span className="text-muted">/{l.event}</span>}
              {l.detail && <span className="text-muted">{l.detail}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
