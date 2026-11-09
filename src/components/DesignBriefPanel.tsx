"use client";

import { useEffect, useState } from "react";
import PlacementEditor from "@/components/PlacementEditor";
import {
  ASSET_ROLES,
  KIND_IDS,
  KINDS,
  MAX_ASSETS,
  MAX_DELIVERABLES,
  SIZE_IDS,
  SIZES,
  aspectOf,
  newDeliverable,
  type AssetRole,
  type Brief,
  type BriefInput,
  type Deliverable,
  type Kind,
} from "@/lib/platform/design-brief";
import type { Theme } from "@/lib/platform/theme-rules";

type Loaded = { brief: Brief; theme: Theme; folder: string };

const inputOf = (b: Brief): BriefInput => ({ event: b.event, branding: b.branding, deliverables: b.deliverables });
const newId = () => `d${[...crypto.getRandomValues(new Uint8Array(4))].map((n) => n.toString(16).padStart(2, "0")).join("")}`;

/**
 * Where the organiser says what the event should look like: texts, pictures, and for each piece (app screens, magnet
 * frame, stickers, sign...) what it is and where the title and date go. Saved as files in the event's folder, so
 * anything else (Claude with Figma and Canva, a script, a designer) can pick it up from there.
 */
export default function DesignBriefPanel({ slug }: { slug: string }) {
  const api = `/api/admin/e/${slug}/design`;
  const [data, setData] = useState<Loaded | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [saved, setSaved] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<AssetRole>("reference");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void fetch(api, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Loaded) => {
        setData(d);
        setBrief(d.brief);
        setSaved(JSON.stringify(inputOf(d.brief)));
        setOpen(d.brief.deliverables[0]?.id ?? null);
      });
  }, [api]);
  if (!data || !brief) return <main className="p-8">טוען...</main>;

  const dirty = JSON.stringify(inputOf(brief)) !== saved;
  const patch = (p: Partial<Brief>) => {
    setBrief({ ...brief, ...p });
    setMsg(null);
  };
  const setPiece = (id: string, p: Partial<Deliverable>) => patch({ deliverables: brief.deliverables.map((d) => (d.id === id ? { ...d, ...p } : d)) });
  const logo = brief.assets.find((a) => a.role === "logo");
  const asset = (id: string) => `${api}/assets/${id}`;

  function add(kind: Kind) {
    if (brief!.deliverables.length >= MAX_DELIVERABLES) return;
    const d = newDeliverable(kind, newId());
    patch({ deliverables: [...brief!.deliverables, d] });
    setOpen(d.id);
  }

  async function save() {
    setBusy(true);
    const res = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inputOf(brief!)) });
    const d = (await res.json().catch(() => ({}))) as { brief?: Brief; error?: string };
    setBusy(false);
    if (res.ok && d.brief) {
      setBrief(d.brief);
      setSaved(JSON.stringify(inputOf(d.brief)));
      setMsg("הבריף נשמר בדיסק");
    } else setMsg(d.error ?? "שגיאה");
  }

  async function upload(file: File | null) {
    if (!file) return;
    setBusy(true);
    const body = new FormData();
    body.set("file", file);
    body.set("role", role);
    const res = await fetch(`${api}/assets`, { method: "POST", body });
    const d = (await res.json().catch(() => ({}))) as { brief?: Brief; error?: string };
    setBusy(false);
    // Only the picture list comes from the server; edits that are not saved yet stay as they are.
    if (res.ok && d.brief) setBrief((b) => (b ? { ...b, assets: d.brief!.assets } : b));
    setMsg(res.ok ? "התמונה נשמרה" : (d.error ?? "שגיאה"));
  }

  async function removeAsset(id: string) {
    const res = await fetch(`${api}/assets/${id}`, { method: "DELETE" });
    const d = (await res.json().catch(() => ({}))) as { brief?: Brief; error?: string };
    if (res.ok && d.brief) {
      setBrief((b) => (b ? { ...b, assets: d.brief!.assets, deliverables: b.deliverables.map((x) => ({ ...x, references: x.references.filter((r) => r !== id) })) } : b));
      setSaved(JSON.stringify(inputOf(d.brief)));
    }
    setMsg(res.ok ? "התמונה נמחקה" : (d.error ?? "שגיאה"));
  }

  // English on purpose: it is pasted to Claude, and mixed Hebrew and file names read badly on screen.
  const prompt = `In the carmel_bar_mitzva repo, use the event-theme-from-invitation skill in brief mode: take the design brief of event ${slug} (brief.md, brief.json, tokens.json and assets/) and make every piece on its list in Figma or Canva, at the sizes and positions the brief gives.`;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-5 py-8">
      <header className="space-y-2">
        <a className="text-muted" href={`/admin/e/${slug}`}>→ חזרה לאירוע</a>
        <h1 className="font-display text-3xl font-bold">בריף עיצוב</h1>
        <p className="text-sm text-muted">
          כאן מגדירים איך האירוע צריך להיראות: טקסטים, תמונות, ולכל פריט (מסכי האפליקציה, מסגרת למגנט, סטיקרים, שלט...) מה כתוב עליו ואיפה. הכול נשמר כקבצים בתיקייה של האירוע, והעיצוב עצמו נוצר מהם אחר כך (למשל על ידי Claude עם Figma ו-Canva). הצבעים והגופנים באים מהעמוד <a className="underline" href={`/admin/e/${slug}/theme`}>עיצוב האירוע</a>.
        </p>
      </header>

      <section className="space-y-3 rounded-3xl border border-line p-5" aria-labelledby="event">
        <h2 id="event" className="font-bold">פרטי האירוע, כפי שיודפסו</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="field" maxLength={80} placeholder="כותרת (הבר מצווה של כרמל)" value={brief.event.title} onChange={(e) => patch({ event: { ...brief.event, title: e.target.value } })} />
          <input className="field" maxLength={60} placeholder="תאריך (כ״ה בחשוון תשפ״ז)" value={brief.event.dateText} onChange={(e) => patch({ event: { ...brief.event, dateText: e.target.value } })} />
          <input className="field" maxLength={80} placeholder="מקום" value={brief.event.venueText} onChange={(e) => patch({ event: { ...brief.event, venueText: e.target.value } })} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="שפה">
          {(["he", "en"] as const).map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={brief.event.language === l} onClick={() => patch({ event: { ...brief.event, language: l } })}>{l === "he" ? "עברית (מימין לשמאל)" : "English"}</button>
          ))}
        </div>
        <textarea className="field min-h-20" maxLength={500} placeholder="אופי ואווירה (אלגנטי, ספורטיבי, מצחיק...)" value={brief.branding.tone} onChange={(e) => patch({ branding: { ...brief.branding, tone: e.target.value } })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <textarea className="field min-h-20" maxLength={500} placeholder="מה אוהבים (צבעים, סמלים, דוגמאות)" value={brief.branding.likes} onChange={(e) => patch({ branding: { ...brief.branding, likes: e.target.value } })} />
          <textarea className="field min-h-20" maxLength={500} placeholder="ממה להימנע" value={brief.branding.avoid} onChange={(e) => patch({ branding: { ...brief.branding, avoid: e.target.value } })} />
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-line p-5" aria-labelledby="pics">
        <h2 id="pics" className="font-bold">תמונות <span className="font-normal text-muted">({brief.assets.length}/{MAX_ASSETS})</span></h2>
        <p className="text-sm text-muted">ההזמנה, הלוגו, דברים שאוהבים או פריטים קיימים שצריך להתאים אליהם. הן נשמרות כקבצים ומצורפות לבריף.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field !w-auto !py-2 !text-base" value={role} onChange={(e) => setRole(e.target.value as AssetRole)} aria-label="סוג התמונה">
            {Object.entries(ASSET_ROLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <label className="btn-ghost min-h-11 cursor-pointer px-4">
            העלאת תמונה
            <input type="file" accept="image/*" className="sr-only" disabled={busy || brief.assets.length >= MAX_ASSETS} onChange={(e) => { void upload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
        </div>
        {brief.assets.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {brief.assets.map((a) => (
              <li key={a.id} className="space-y-1 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-only upload of the event's own */}
                <img src={asset(a.id)} alt={a.name} className="aspect-square w-full rounded-xl border border-line bg-olive-100 object-contain" />
                <p className="font-bold">{ASSET_ROLES[a.role]}</p>
                <p className="truncate text-muted" title={a.name}>{a.name}</p>
                <button type="button" className="underline" onClick={() => void removeAsset(a.id)}>מחיקה</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="pieces">
        <h2 id="pieces" className="font-bold">מה צריך ליצור <span className="font-normal text-muted">({brief.deliverables.length})</span></h2>
        <div className="flex flex-wrap gap-2">
          {KIND_IDS.map((k) => (
            <button key={k} type="button" className="chip !px-3 !py-1.5 text-sm" disabled={brief.deliverables.length >= MAX_DELIVERABLES} onClick={() => add(k)}>+ {KINDS[k].label}</button>
          ))}
        </div>
        {brief.deliverables.length === 0 && <p className="text-sm text-muted">עוד לא נוסף כלום. בחרו למעלה מה צריך ליצור.</p>}
        <ul className="space-y-3">
          {brief.deliverables.map((d) => {
            const isOpen = open === d.id;
            return (
              <li key={d.id} className="rounded-3xl border border-line">
                <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-start" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.id)}>
                  <span className="font-bold">{d.name} <span className="font-normal text-muted">· {KINDS[d.kind].label} · {SIZES[d.size]?.label}</span></span>
                  <span aria-hidden>{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-line p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="field" maxLength={80} value={d.name} onChange={(e) => setPiece(d.id, { name: e.target.value })} aria-label="שם הפריט" />
                      <select className="field" value={d.size} onChange={(e) => setPiece(d.id, { size: e.target.value })} aria-label="גודל">
                        {SIZE_IDS.map((s) => <option key={s} value={s}>{SIZES[s].label}</option>)}
                      </select>
                    </div>
                    <textarea className="field min-h-24" maxLength={2000} placeholder="במילים שלכם: איך זה צריך להיראות, מה מופיע, למי זה מיועד" value={d.notes} onChange={(e) => setPiece(d.id, { notes: e.target.value })} />
                    {brief.assets.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-bold">להסתכל על (השראה או פריט קיים)</p>
                        <div className="flex flex-wrap gap-2">
                          {brief.assets.map((a) => {
                            const on = d.references.includes(a.id);
                            return (
                              <button key={a.id} type="button" aria-pressed={on} className="chip flex items-center gap-2 !px-2 !py-1 text-sm" onClick={() => setPiece(d.id, { references: on ? d.references.filter((r) => r !== a.id) : [...d.references, a.id].slice(0, 10) })}>
                                {/* eslint-disable-next-line @next/next/no-img-element -- admin-only */}
                                <img src={asset(a.id)} alt="" className="size-7 rounded object-cover" />
                                {a.name || ASSET_ROLES[a.role]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-bold">מיקום הכותרת, התאריך ושאר הפרטים</p>
                      <p className="text-sm text-muted">גוררים כל פריט למקום שלו. הרקע והגופנים הם של האירוע.</p>
                      <PlacementEditor
                        aspect={aspectOf(d.size)}
                        elements={d.elements}
                        texts={{ title: brief.event.title, date: brief.event.dateText, venue: brief.event.venueText }}
                        theme={data.theme}
                        logoSrc={logo ? asset(logo.id) : undefined}
                        onChange={(elements) => setPiece(d.id, { elements })}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => { const c = { ...d, id: newId(), name: `${d.name} (עותק)` }; patch({ deliverables: [...brief.deliverables, c] }); setOpen(c.id); }}>שכפול</button>
                      <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => patch({ deliverables: brief.deliverables.filter((x) => x.id !== d.id) })}>מחיקה</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2 rounded-3xl bg-olive-100 p-5 text-sm">
        <h2 className="font-bold">איך ממשיכים משם</h2>
        <p>הבריף נשמר בדיסק, בתיקייה הזאת:</p>
        <p><bdi><code dir="ltr" className="rounded bg-white/70 px-2 py-1">DATA_DIR/{data.folder}/</code></bdi></p>
        <p>
          בתוכה יש את <bdi><code dir="ltr">brief.json</code></bdi> (המבנה, למכונות), את <bdi><code dir="ltr">brief.md</code></bdi> (אותו דבר במילים) ואת התיקייה <bdi><code dir="ltr">assets</code></bdi> (התמונות). אפשר לקרוא אותם ישר משם, או להוריד חבילה אחת שכוללת גם את העיצוב הנוכחי של האירוע.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost min-h-10 px-4" href={`${api}/export`}>⬇️ חבילת בריף (ZIP)</a>
          <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => void navigator.clipboard?.writeText(prompt).then(() => setMsg("ההנחיה הועתקה"))}>העתקת הנחיה ל-Claude</button>
        </div>
        <p dir="ltr" className="text-start text-muted">{prompt}</p>
      </section>

      <div className="sticky bottom-0 -mx-5 space-y-2 border-t border-line bg-canvas/95 px-5 py-3 backdrop-blur">
        {msg && <p role="status" className="text-accent">{msg}</p>}
        <button className="btn-primary w-full" onClick={() => void save()} disabled={!dirty || busy}>{dirty ? "שמירה" : "אין שינויים לשמירה"}</button>
      </div>
    </main>
  );
}
