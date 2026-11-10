"use client";

import { useEffect, useMemo, useState } from "react";
import { contrast } from "@/lib/platform/color";
import { fitTheme, type ThemeDesign } from "@/lib/platform/theme-fit";
import {
  BACKDROPS,
  COLOR_KEYS,
  DEFAULT_THEME,
  FONT_PAIRS,
  PRESETS,
  SHAPES,
  isDark,
  resolveColors,
  themeWrapperStyle,
  type Backdrop,
  type ColorKey,
  type FontPair,
  type Shape,
  type Theme,
} from "@/lib/platform/theme-rules";

const COLOR_LABEL: Record<ColorKey, string> = {
  canvas: "רקע",
  surface: "כרטיסים",
  ink: "טקסט",
  muted: "טקסט משני",
  accent: "צבע ראשי",
  accentSoft: "צבע ראשי בהיר",
  line: "קווים",
  tint: "רקע עדין",
  highlight: "הדגשה",
};

type Filter = "all" | "light" | "dark";

/** The preview and the gallery cards are small guest pages: the same wrapper style the real guest pages get. */
const previewStyle = (theme: Theme) => ({ ...themeWrapperStyle(theme), minHeight: undefined });

export default function ThemePanel({ slug }: { slug: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [saved, setSaved] = useState<Theme | null>(null);
  const [custom, setCustom] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [design, setDesign] = useState<ThemeDesign | null>(null);
  const [designing, setDesigning] = useState(false);
  const [invitation, setInvitation] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const api = `/api/admin/e/${slug}/theme`;

  useEffect(() => {
    void fetch(api, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { theme: Theme; custom: boolean }) => {
        setTheme(d.theme);
        setSaved(d.theme);
        setCustom(d.custom);
      });
  }, [api]);

  // What the current colours would need to be readable; computed from the theme, so it follows every colour change.
  const fixed = useMemo(() => {
    if (!theme) return null;
    const preset = PRESETS[theme.preset];
    const colors = resolveColors(theme);
    return fitTheme({
      mood: "",
      scheme: isDark(colors) ? "dark" : "light",
      basedOn: theme.preset,
      colors,
      fonts: theme.fonts ?? preset.fonts,
      shape: theme.shape ?? preset.shape,
      backdrop: theme.backdrop ?? preset.backdrop,
      headline: theme.headline,
      notes: "",
    });
  }, [theme]);

  if (!theme || !fixed) return <main className="p-8">טוען...</main>;

  const preset = PRESETS[theme.preset];
  const colors = resolveColors(theme);
  const set = (patch: Partial<Theme>) => {
    setTheme({ ...theme, ...patch });
    setMsg(null);
  };
  const unreadable = contrast(colors.ink, colors.canvas) < 4.5 || contrast(colors.accent, colors.canvas) < 3 || contrast(colors.muted, colors.canvas) < 3;
  const dirty = JSON.stringify(theme) !== JSON.stringify(saved);

  async function save() {
    const res = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(theme) });
    const d = (await res.json()) as { error?: string };
    if (res.ok) setSaved(theme);
    setMsg(res.ok ? "העיצוב נשמר" : (d.error ?? "שגיאה"));
  }
  async function logo(file: File | null, remove = false) {
    const body = new FormData();
    if (file) body.set("logo", file);
    const res = await fetch(`${api}/logo`, { method: remove ? "DELETE" : "POST", body: remove ? undefined : body });
    const d = (await res.json()) as { error?: string };
    if (res.ok) {
      setTheme({ ...theme!, hasLogo: !remove });
      setSaved((s) => (s ? { ...s, hasLogo: !remove } : s));
      setLogoVersion((v) => v + 1);
    }
    setMsg(res.ok ? (remove ? "הלוגו הוסר" : "הלוגו הועלה") : (d.error ?? "שגיאה"));
  }
  async function fromInvitation() {
    if (!invitation) return;
    setDesigning(true);
    setMsg(null);
    const body = new FormData();
    body.set("image", invitation);
    body.set("hint", hint);
    try {
      const res = await fetch(`${api}/from-invitation`, { method: "POST", body });
      const d = (await res.json()) as { design?: ThemeDesign; error?: string };
      if (res.ok && d.design) {
        setDesign(d.design);
        // Shown in the preview only. Saved when the organiser presses save, like any other change.
        setTheme({ ...d.design.theme, hasLogo: theme!.hasLogo });
      } else {
        setMsg(d.error ?? "שגיאה");
      }
    } catch {
      setMsg("התקשורת נכשלה, נסו שוב");
    } finally {
      setDesigning(false);
    }
  }

  const visible = Object.entries(PRESETS).filter(([, p]) => filter === "all" || (filter === "dark") === isDark(p.colors));

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-8">
        <header className="space-y-2">
          <a className="text-muted" href={`/admin/e/${slug}`}>→ חזרה לאירוע</a>
          <h1 className="font-display text-3xl font-bold">עיצוב האירוע</h1>
          <p className="text-sm text-muted">
            בחרו ערכה מוכנה, התאימו אותה, או העלו את ההזמנה ונתאים את העיצוב אליה. העיצוב חל רק על עמודי האורחים של האירוע הזה; אירועים אחרים שרצים באותו זמן לא מושפעים.
          </p>
        </header>

        <section aria-labelledby="gallery" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="gallery" className="font-bold">ערכות מוכנות <span className="font-normal text-muted">({Object.keys(PRESETS).length})</span></h2>
            <div className="flex gap-2" role="group" aria-label="סינון לפי רקע">
              {([["all", "הכול"], ["light", "בהיר"], ["dark", "כהה"]] as const).map(([id, label]) => (
                <button key={id} type="button" className="chip !px-3 !py-1.5 text-sm" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map(([id, p]) => {
              const sample: Theme = { ...DEFAULT_THEME, preset: id };
              const on = theme.preset === id && Object.keys(theme.colors).length === 0 && !theme.fonts && !theme.shape && !theme.backdrop;
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      set({ preset: id, colors: {}, fonts: undefined, shape: undefined, backdrop: undefined });
                      setDesign(null);
                    }}
                    className={`block w-full overflow-hidden rounded-2xl border-2 text-start transition active:scale-[0.98] ${on ? "border-accent" : "border-line hover:border-accent-soft"}`}
                  >
                    <span className="block space-y-2 p-3" style={previewStyle(sample)}>
                      <span className="block font-display text-xl font-bold leading-tight">מזל טוב</span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-5 w-12 rounded-(--btn-radius)" style={{ background: "var(--color-accent)" }} />
                        <span className="inline-block size-3 rounded-full" style={{ background: "var(--color-clay)" }} />
                        <span className="inline-block size-3 rounded-full" style={{ background: "var(--color-accent-soft)" }} />
                      </span>
                    </span>
                    <span className="block bg-surface px-3 py-2">
                      <span className="block text-sm font-bold">{p.label}{on && " ✓"}</span>
                      <span className="block text-xs text-muted">{p.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <fieldset className="space-y-3 rounded-3xl border border-line p-5" disabled={!custom || designing}>
          <legend className="px-2 font-bold">
            עיצוב מהזמנה <span className="font-normal text-muted">{!custom ? "(לא כלול ברישיון האירוע)" : ""}</span>
          </legend>
          <p className="text-sm text-muted">
            מעלים תמונה של ההזמנה (או לוגו, באנר, דף מיתוג) ומקבלים עיצוב באותה אווירה: צבעים, גופנים, צורת פינות ורקע. מקבלים תצוגה מקדימה, ושום דבר לא נשמר עד שלוחצים על שמירה. התמונה נשלחת לניתוח ב-AI ולא נשמרת.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-ghost min-h-11 cursor-pointer px-4">
              {invitation ? "החלפת תמונה" : "בחירת תמונת הזמנה"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setInvitation(e.target.files?.[0] ?? null)} />
            </label>
            {invitation && <span className="text-sm text-muted">{invitation.name}</span>}
          </div>
          <input className="field" maxLength={200} placeholder="רוצים להדגיש משהו? (למשל: להשאיר את הזהב, אווירה צעירה יותר)" value={hint} onChange={(e) => setHint(e.target.value)} />
          <button type="button" className="btn-primary w-full" disabled={!invitation || designing} onClick={() => void fromInvitation()}>
            {designing ? "קוראים את ההזמנה..." : "יצירת עיצוב מההזמנה"}
          </button>

          {design && (
            <div className="space-y-2 rounded-2xl bg-olive-100 p-4 text-sm" role="status">
              <p className="font-bold">{design.mood}</p>
              {design.notes && <p>{design.notes}</p>}
              <div className="flex flex-wrap items-center gap-1.5" aria-label="הצבעים שנקראו מהתמונה">
                {design.palette.map((hex) => <span key={hex} title={hex} className="inline-block size-6 rounded-full border border-line" style={{ background: hex }} />)}
              </div>
              <p className="text-muted">
                {design.source === "ai" ? "נוצר בעזרת AI שראה את התמונה" : "נוצר מהצבעים הדומיננטיים בתמונה (בלי AI)"}
                {design.adjusted.length > 0 && ` · תוקן אוטומטית לקריאות: ${design.adjusted.map((k) => COLOR_LABEL[k]).join(", ")}`}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => { setTheme(saved); setDesign(null); setMsg(null); }}>ביטול, חזרה לעיצוב השמור</button>
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4 rounded-3xl border border-line p-5" disabled={!custom}>
          <legend className="px-2 font-bold">התאמה אישית {!custom && <span className="font-normal text-muted">(לא כלולה ברישיון האירוע)</span>}</legend>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="color" value={colors[k]} onChange={(e) => set({ colors: { ...theme.colors, [k]: e.target.value } })} aria-label={COLOR_LABEL[k]} />
                {COLOR_LABEL[k]}
              </label>
            ))}
          </div>
          {unreadable && (
            <div className="rounded-2xl bg-red-500/15 p-3 text-sm" role="alert">
              <p>הצבעים האלה יקשו על הקריאה בטלפון.</p>
              <button type="button" className="mt-2 underline" onClick={() => set({ ...fixed.theme, hasLogo: theme.hasLogo })}>
                תקנו אוטומטית (משנה: {fixed.adjusted.map((k) => COLOR_LABEL[k]).join(", ") || "כלום"})
              </button>
            </div>
          )}

          <label className="block space-y-1 text-sm">
            <span className="font-bold">גופנים</span>
            <select className="field" value={theme.fonts ?? ""} onChange={(e) => set({ fonts: (e.target.value || undefined) as FontPair | undefined })}>
              <option value="">גופנים של הערכה ({FONT_PAIRS[preset.fonts].label})</option>
              {Object.entries(FONT_PAIRS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
            </select>
          </label>

          <div className="space-y-1 text-sm">
            <span className="font-bold">פינות</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="צורת פינות">
              {(Object.entries(SHAPES) as [Shape, (typeof SHAPES)[Shape]][]).map(([id, s]) => (
                <button key={id} type="button" className="chip" aria-pressed={(theme.shape ?? preset.shape) === id} onClick={() => set({ shape: id })}>{s.label}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <span className="font-bold">רקע</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="רקע העמוד">
              {(Object.entries(BACKDROPS) as [Backdrop, (typeof BACKDROPS)[Backdrop]][]).map(([id, b]) => (
                <button key={id} type="button" className="chip" aria-pressed={(theme.backdrop ?? preset.backdrop) === id} onClick={() => set({ backdrop: id })}>{b.label}</button>
              ))}
            </div>
          </div>

          <input className="field" maxLength={40} placeholder="כותרת במסך הפתיחה (ריק = ברירת המחדל)" value={theme.headline} onChange={(e) => set({ headline: e.target.value })} />

          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost min-h-10 cursor-pointer px-4">
              {theme.hasLogo ? "החלפת לוגו" : "העלאת לוגו"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void logo(e.target.files?.[0] ?? null)} />
            </label>
            {theme.hasLogo && <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => void logo(null, true)}>הסרת לוגו</button>}
            <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => { set({ colors: {}, fonts: undefined, shape: undefined, backdrop: undefined, headline: "" }); setDesign(null); }}>
              איפוס לערכה
            </button>
          </div>
        </fieldset>

        <div className="sticky bottom-0 -mx-5 space-y-2 border-t border-line bg-canvas/95 px-5 py-3 backdrop-blur">
          {msg && <p role="status" className="text-accent">{msg}</p>}
          <button className="btn-primary w-full" onClick={save} disabled={!dirty}>{dirty ? "שמירה" : "אין שינויים לשמירה"}</button>
        </div>
      </div>

      <aside aria-label="תצוגה מקדימה" className="h-fit space-y-2 lg:sticky lg:top-6">
        <p className="text-sm font-bold">כך ייראו עמודי האורחים</p>
        <div className="space-y-3 overflow-hidden rounded-[2rem] border border-line p-5" style={previewStyle(theme)}>
          {theme.hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element -- the event's own logo
            <img src={`/api/e/${slug}/logo?v=${logoVersion}`} alt="" className="mx-auto max-h-16" />
          )}
          <p className="text-center font-display text-4xl font-bold leading-tight">{theme.headline || "מזל טוב"}</p>
          <p className="text-center font-display text-2xl font-medium" style={{ color: "var(--color-clay)" }}>לכרמל</p>
          <p className="text-center" style={{ color: "var(--color-muted)" }}>כתבו ברכה וקבלו פוסטר אישי</p>
          <div className="card p-4"><p className="font-bold">שם מלא</p><p style={{ color: "var(--color-muted)" }}>למשל: דנה כהן</p></div>
          <div className="field">הקלידו כאן...</div>
          <div className="flex flex-wrap gap-2">
            <span className="chip" aria-pressed="true">נבחר</span>
            <span className="chip">לא נבחר</span>
            <span className="rounded-(--btn-radius) bg-olive-100 px-3 py-1 text-sm" style={{ color: "var(--color-accent)" }}>תגית</span>
          </div>
          <div className="btn-primary w-full">התחלה</div>
        </div>
      </aside>
    </main>
  );
}
