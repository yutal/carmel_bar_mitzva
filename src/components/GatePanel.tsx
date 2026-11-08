"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";

type GateView = {
  gate: { required: boolean; gen: number; closed: boolean };
  window: { startsAt: string | null; endsAt: string | null };
  limits: { maxKeyHours: number; rollingMinutes: number; screenKeyHours: number };
};
type Minted = { kind: "guest" | "screen"; url: string; notBefore: string; expiresAt: string; qr?: string };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "ללא הגבלה");

/** Entry gate: who gets in through the QR code, for how long, and the switches to close or replace it at once. */
export default function GatePanel({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const api = `/api/admin/e/${slug}/gate`;
  const [view, setView] = useState<GateView | null>(null);
  const [minted, setMinted] = useState<Minted | null>(null);
  const [hours, setHours] = useState(24);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(api, { cache: "no-store" });
    if (res.ok) setView((await res.json()) as GateView);
  }, [api]);
  useEffect(() => {
    void fetch(api, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d: GateView | null) => d && setView(d));
  }, [api]);

  async function post(body: object): Promise<Record<string, unknown> | null> {
    setMsg(null);
    const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      setMsg(String(d.error ?? "שגיאה"));
      return null;
    }
    await load();
    return d;
  }

  async function mint(kind: "guest" | "screen") {
    const d = await post({ action: "mint", kind, hours: kind === "guest" ? hours : undefined });
    if (!d) return;
    const m = { kind, url: String(d.url), notBefore: String(d.notBefore), expiresAt: String(d.expiresAt) };
    setMinted({ ...m, qr: await QRCode.toDataURL(m.url, { margin: 2, width: 480 }) });
  }

  if (!view) return <main className="p-8">טוען...</main>;
  const { gate, window: w, limits } = view;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-5 py-8">
      <a className="text-muted" href={`/admin/e/${slug}`}>→ חזרה לאירוע</a>
      <h1 className="font-display text-3xl font-bold">שער כניסה /{slug}</h1>
      <p className="text-sm text-muted">
        קוד ה-QR מכיל מפתח חתום עם תוקף. הסריקה מחליפה אותו בעוגייה לכמה שעות, וכל פניות האורח לשרת דורשות אותה. כתובת חשופה, צילום מסך ישן או קוד מאירוע אחר לא פותחים כלום.
      </p>

      <section className="card space-y-2 p-4">
        <p className="font-bold">{!gate.required ? "⚠️ השער כבוי: כל מי שמכיר את הכתובת נכנס" : gate.closed ? "🔒 הכניסה סגורה כרגע" : "✅ הכניסה פתוחה לפי חלון הרישיון"}</p>
        <p className="text-muted">חלון הרישיון: {when(w.startsAt)} עד {when(w.endsAt)}. מפתח לעולם לא חי מעבר לסוף החלון.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => post({ action: gate.closed ? "open" : "close" })}>{gate.closed ? "פתח כניסה" : "סגור כניסה עכשיו"}</button>
          <button className="btn-ghost" onClick={() => confirm("כל הקודים והעוגיות שהונפקו עד עכשיו יפסיקו לעבוד. להמשיך?") && post({ action: "rotate" })}>החלף מפתח (מבטל קודים קיימים)</button>
          {isOwner && <button className="btn-ghost" onClick={() => post({ action: "require", required: !gate.required })}>{gate.required ? "בטל דרישת QR (לא מומלץ)" : "דרוש קוד QR"}</button>}
        </div>
        <p className="text-sm text-muted">דור מפתח נוכחי: {gate.gen}</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">קוד QR להדפסה</h2>
        <label className="block space-y-1">
          <span className="text-muted">תוקף בשעות מעכשיו (עד {limits.maxKeyHours}, ולא מעבר לסוף הרישיון)</span>
          <input className="field" type="number" min={1} max={limits.maxKeyHours} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} />
        </label>
        <button className="btn-primary" onClick={() => mint("guest")}>צור קוד לאורחים</button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">מסך האולם</h2>
        <p className="text-sm text-muted">
          המסך מציג קוד שמתחדש לבד כל כמה דקות (תוקף של {limits.rollingMinutes} דקות), כך שצילום שלו מתיישן. כדי להרשות מסך, פתחו בו פעם אחת את קישור המסך. הוא תקף {limits.screenKeyHours} שעות.
        </p>
        <button className="btn-primary" onClick={() => mint("screen")}>צור קישור למסך</button>
      </section>

      {minted && (
        <section className="card space-y-3 p-4" aria-live="polite">
          <h2 className="font-bold">{minted.kind === "guest" ? "קוד לאורחים" : "קישור למסך האולם"}</h2>
          {minted.qr && minted.kind === "guest" && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img src={minted.qr} alt="קוד QR לאורחים" className="mx-auto size-60 rounded-xl bg-white" />
          )}
          <p className="text-sm text-muted">תקף מ-{when(minted.notBefore)} עד {when(minted.expiresAt)}</p>
          <input className="field" readOnly dir="ltr" value={minted.url} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => void navigator.clipboard?.writeText(minted.url)}>העתק קישור</button>
            {minted.qr && minted.kind === "guest" && <a className="btn-ghost" href={minted.qr} download={`${slug}-qr.png`}>הורד PNG</a>}
          </div>
          <p className="text-sm text-accent">הקישור הוא המפתח: שמרו אותו כמו סיסמה. הוא לא נשמר בשרת ולא יוצג שוב.</p>
        </section>
      )}
      {msg && <p role="alert" className="text-accent">{msg}</p>}
    </main>
  );
}
