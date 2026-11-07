"use client";

import { useEffect, useState } from "react";
import { COLOR_KEYS, FONT_PAIRS, PRESETS, themeVars, type ColorKey, type FontPair, type Theme } from "@/lib/platform/theme-rules";

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

export default function ThemePanel({ slug }: { slug: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [custom, setCustom] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState(0);
  const api = `/api/admin/e/${slug}/theme`;

  useEffect(() => {
    void fetch(api, { cache: "no-store" }).then((r) => r.json()).then((d: { theme: Theme; custom: boolean }) => {
      setTheme(d.theme);
      setCustom(d.custom);
    });
  }, [api]);
  if (!theme) return <main className="p-8">טוען...</main>;

  const preset = PRESETS[theme.preset];
  const vars = themeVars(theme);
  const set = (patch: Partial<Theme>) => setTheme({ ...theme, ...patch });

  async function save() {
    const res = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(theme) });
    const d = (await res.json()) as { error?: string };
    setMsg(res.ok ? "העיצוב נשמר" : (d.error ?? "שגיאה"));
  }
  async function logo(file: File | null, remove = false) {
    const body = new FormData();
    if (file) body.set("logo", file);
    const res = await fetch(`${api}/logo`, { method: remove ? "DELETE" : "POST", body: remove ? undefined : body });
    const d = (await res.json()) as { error?: string };
    if (res.ok) {
      setTheme({ ...theme!, hasLogo: !remove });
      setLogoVersion((v) => v + 1);
    }
    setMsg(res.ok ? (remove ? "הלוגו הוסר" : "הלוגו הועלה") : (d.error ?? "שגיאה"));
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 md:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <a className="text-muted" href={`/admin/e/${slug}`}>→ חזרה לאירוע</a>
        <h1 className="font-display text-3xl font-bold">עיצוב האירוע</h1>
        <p className="text-sm text-muted">העיצוב חל רק על עמודי האורחים של האירוע הזה. אירועים אחרים שרצים באותו זמן לא מושפעים.</p>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">ערכה מוכנה</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([id, p]) => (
              <button key={id} type="button" className="chip" aria-pressed={theme.preset === id} onClick={() => set({ preset: id, colors: {}, fonts: undefined })}>
                <span className="me-2 inline-block size-3 rounded-full align-middle" style={{ background: p.colors.accent }} />
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3" disabled={!custom}>
          <legend className="mb-2 font-bold">התאמה אישית {!custom && <span className="font-normal text-muted">(לא כלולה ברישיון האירוע)</span>}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="color" value={{ ...preset.colors, ...theme.colors }[k]} onChange={(e) => set({ colors: { ...theme.colors, [k]: e.target.value } })} />
                {COLOR_LABEL[k]}
              </label>
            ))}
          </div>
          <select className="field" value={theme.fonts ?? ""} onChange={(e) => set({ fonts: (e.target.value || undefined) as FontPair | undefined })}>
            <option value="">גופנים של הערכה ({FONT_PAIRS[preset.fonts].label})</option>
            {Object.entries(FONT_PAIRS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
          </select>
          <input className="field" maxLength={40} placeholder="כותרת במסך הפתיחה (ריק = ברירת המחדל)" value={theme.headline} onChange={(e) => set({ headline: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost min-h-10 cursor-pointer px-4">
              {theme.hasLogo ? "החלפת לוגו" : "העלאת לוגו"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void logo(e.target.files?.[0] ?? null)} />
            </label>
            {theme.hasLogo && <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => void logo(null, true)}>הסרת לוגו</button>}
          </div>
        </fieldset>

        {msg && <p role="status" className="text-accent">{msg}</p>}
        <button className="btn-primary w-full" onClick={save}>שמירה</button>
      </div>

      <aside aria-label="תצוגה מקדימה" className="h-fit space-y-3 rounded-3xl border border-line p-5" style={{ ...vars, background: "var(--color-canvas)", color: "var(--color-ink)" }}>
        {theme.hasLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- the event's own logo
          <img src={`/api/e/${slug}/logo?v=${logoVersion}`} alt="" className="mx-auto max-h-16" />
        )}
        <p className="text-center font-display text-3xl font-bold">{theme.headline || "מזל טוב"}</p>
        <p className="text-center" style={{ color: "var(--color-muted)" }}>כך ייראו עמודי האורחים</p>
        <div className="card p-4"><p>כרטיס עם טקסט</p></div>
        <button type="button" className="btn-primary w-full">התחלה</button>
        <button type="button" className="chip" aria-pressed="true">נבחר</button>
        <button type="button" className="chip">לא נבחר</button>
      </aside>
    </main>
  );
}
