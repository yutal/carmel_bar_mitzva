"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_INFO, LANGS, STRINGS, type Lang } from "@/lib/i18n";
import { IMAGE_STYLES, MUSIC_STYLES, type ImageStyle, type MusicStyle } from "@/lib/types";
import { resizeImage } from "./resize-image";

type Form = {
  fullName: string;
  relationship: string;
  together: string;
  memory: string;
  talent: string;
  blessing: string;
  imageStyle: ImageStyle;
  withSong: boolean;
  musicStyle: MusicStyle;
  consentScreen: boolean;
  consentMarketing: boolean;
};

const STEPS = ["welcome", "who", "story", "blessing", "experience", "photo"] as const;
type Step = (typeof STEPS)[number];
// "Just a blessing": no story, style or photo, so no image is made.
const BLESSING_STEPS: readonly Step[] = ["welcome", "who", "blessing"];

export default function GuestFlow({ again, lang = "he" }: { again?: { fullName: string; relationship: string }; lang?: Lang }) {
  const router = useRouter();
  const t = STRINGS[lang];
  const RELATIONSHIPS = t.relationships;
  const [names, setNames] = useState({ he: "כרמל", en: "Carmel" });
  const name = names[lang];
  const [songsEnabled, setSongsEnabled] = useState(false);
  const [maxCreations, setMaxCreations] = useState<number | null>(null);
  const [step, setStep] = useState<Step>(again ? "who" : "welcome");
  const [blessingOnly, setBlessingOnly] = useState(false);
  const steps = blessingOnly ? BLESSING_STEPS : STEPS;
  const lastStep = steps[steps.length - 1];
  const [form, setForm] = useState<Form>({
    fullName: again?.fullName ?? "",
    relationship: again?.relationship ?? "",
    together: "",
    memory: "",
    talent: "",
    blessing: "",
    imageStyle: "movie",
    withSong: false,
    musicStyle: "auto",
    consentScreen: true,
    consentMarketing: false,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  useEffect(() => {
    fetch("/api/celebrant")
      .then((r) => r.json())
      .then((d: { celebrantName?: string; celebrantNameEn?: string; songsEnabled?: boolean; maxCreations?: number | null }) => {
        if (d.celebrantName) setNames({ he: d.celebrantName, en: d.celebrantNameEn || d.celebrantName });
        setSongsEnabled(Boolean(d.songsEnabled));
        setMaxCreations(d.maxCreations ?? null);
      })
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const index = steps.indexOf(step);
  const go = (delta: number) => {
    setError(null);
    const target = steps[Math.min(steps.length - 1, Math.max(0, index + delta))];
    if (target === "welcome") setBlessingOnly(false);
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [checking, setChecking] = useState(false);
  /** Leaving the "who" step checks the per-guest limit, so nobody fills in everything only to be refused. */
  async function next() {
    if (step === "who" && !blessingOnly) {
      setChecking(true);
      try {
        const res = await fetch(`/api/quota?name=${encodeURIComponent(form.fullName.trim())}`, { cache: "no-store" });
        const q = (await res.json()) as { max: number | null; remaining: number | null };
        if (q.remaining === 0) {
          setError(t.quotaReached(q.max));
          return;
        }
      } catch {
        // If the check fails, the server still enforces the limit on submit.
      } finally {
        setChecking(false);
      }
    }
    go(1);
  }

  const canContinue: Record<Step, boolean> = {
    welcome: true,
    who: form.fullName.trim().length >= 2 && form.relationship.trim().length > 0,
    story: Boolean(form.together.trim() || form.memory.trim() || form.talent.trim()),
    blessing: form.blessing.trim().length >= 5,
    experience: true,
    photo: true,
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      const { withSong, ...fields } = form;
      for (const [k, v] of Object.entries(fields)) body.set(k, String(v));
      body.set("experience", blessingOnly ? "blessing" : songsEnabled && withSong ? "both" : "image");
      body.set("lang", lang);
      body.set("consentPhoto", String(Boolean(photo) && !blessingOnly));
      if (photo && !blessingOnly) body.set("photo", await resizeImage(photo), "photo.jpg");
      const res = await fetch("/api/submissions", { method: "POST", body });
      const data = (await res.json()) as { publicId?: string; error?: string };
      if (!res.ok || !data.publicId) throw new Error(data.error ?? t.genericError);
      // Replace, so the back button cannot return to a filled form and send it again.
      router.replace(`/r/${data.publicId}${lang === "he" ? "" : `?lang=${lang}`}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setSubmitting(false);
    }
  }

  return (
    <main dir={LANG_INFO[lang].dir} lang={lang} className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-6">
      {step !== "welcome" && (
        <header className="mb-6 flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} className="text-muted">
            {t.back}
          </button>
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {steps.slice(1).map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-accent-soft" : "bg-line"}`} />
            ))}
          </div>
        </header>
      )}

      <div className="flex flex-1 flex-col">
        {step === "welcome" && (
          <section className="flex flex-1 flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium tracking-[0.2em] text-muted">{t.station}</span>
              <nav className="relative z-10 flex gap-1 text-sm" aria-label="Language">
                {LANGS.map((l) => (
                  // A plain link: a full load starts the flow fresh in the other language.
                  <a
                    key={l}
                    href={l === "he" ? "/" : `/?lang=${l}`}
                    aria-current={l === lang ? "true" : undefined}
                    className="rounded-full px-3 py-1 text-muted aria-[current]:bg-olive-100 aria-[current]:font-bold aria-[current]:text-ink"
                  >
                    {LANG_INFO[l].label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="text-center">
              <p className="pointer-events-none font-display text-[clamp(10rem,58vw,15rem)] font-black leading-[0.82] tracking-tight text-accent-soft" aria-hidden>
                13
              </p>
              <h1 className="mt-2 font-display leading-none">
                <span className="block text-[3.25rem] font-bold text-ink">{t.heroLines(name)[0]}</span>
                <span className="mt-1 block text-[2.5rem] font-medium text-clay">{t.heroLines(name)[1]}</span>
              </h1>
            </div>
            <span className="mx-auto h-0.5 w-14 bg-line" aria-hidden />
            <p className="text-center text-lg leading-relaxed text-muted">
              {t.intro(name, songsEnabled)}
            </p>
            <div className="space-y-2">
              <button type="button" className="btn-primary w-full" onClick={() => go(1)}>
                {t.start} <span aria-hidden>{t.forwardArrow}</span>
              </button>
              <button
                type="button"
                className="w-full py-2 text-center text-accent underline underline-offset-4"
                onClick={() => {
                  setBlessingOnly(true);
                  setStep("who");
                }}
              >
                {t.blessingOnly}
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-bold tracking-[0.2em] text-accent-soft">{t.howItWorks}</p>
              <ol className="grid grid-cols-3 gap-2.5">
                {t.howSteps(songsEnabled).map(([title, body], i) => (
                  <li key={title} className="card space-y-1 p-3.5">
                    <span className="block text-2xl font-bold text-accent-soft">{i + 1}</span>
                    <span className="block text-[0.95rem] font-bold leading-tight">{title}</span>
                    <span className="block text-sm text-muted">{body}</span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-center text-xs text-accent-soft">{t.meta(name, maxCreations)}</p>
          </section>
        )}

        {step === "who" && (
          <section className="space-y-6">
            <h2 className="font-display text-[2rem] font-bold text-ink">{t.whoTitle}</h2>
            <label className="block space-y-2">
              <span className="text-muted">{t.fullName}</span>
              <input className="field" autoComplete="name" value={form.fullName} maxLength={60} onChange={(e) => set("fullName", e.target.value)} placeholder={t.fullNamePlaceholder} />
            </label>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-muted">{t.relationshipLegend(name)}</legend>
              <div className="flex flex-wrap gap-2">
                {RELATIONSHIPS.map((r) => (
                  <button key={r} type="button" className="chip" aria-pressed={form.relationship === r} onClick={() => set("relationship", r)}>
                    {r}
                  </button>
                ))}
              </div>
              <input
                className="field"
                value={RELATIONSHIPS.includes(form.relationship) ? "" : form.relationship}
                maxLength={60}
                onChange={(e) => set("relationship", e.target.value)}
                placeholder={t.relationshipOther}
              />
            </fieldset>
          </section>
        )}

        {step === "story" && (
          <section className="space-y-6">
            <div>
              <h2 className="font-display text-[2rem] font-bold text-ink">{t.storyTitle}</h2>
              <p className="mt-3 rounded-2xl bg-olive-100 px-4 py-3 text-accent">
                🎨 <strong>{t.storyNote(songsEnabled)[0]}</strong> {t.storyNote(songsEnabled)[1]}
              </p>
              <p className="mt-2 text-muted">{t.storyHint}</p>
            </div>
            <Question label={t.qTogether(name)} placeholder={t.pTogether} value={form.together} max={300} onChange={(v) => set("together", v)} />
            <Question label={t.qMemory} placeholder={t.pMemory} value={form.memory} max={600} rows={4} onChange={(v) => set("memory", v)} />
            <Question label={t.qTalent(name)} placeholder={t.pTalent} value={form.talent} max={300} onChange={(v) => set("talent", v)} />
          </section>
        )}

        {step === "blessing" && (
          <section className="space-y-4">
            <h2 className="font-display text-[2rem] font-bold text-ink">{t.blessingTitle(name)}</h2>
            <p className="text-muted">{blessingOnly ? t.blessingOnlyHint : t.blessingHint(name)}</p>
            <textarea
              className="field min-h-48 leading-relaxed"
              value={form.blessing}
              maxLength={600}
              onChange={(e) => set("blessing", e.target.value)}
              placeholder={t.blessingPlaceholder(name)}
            />
            <p className="text-end text-sm text-muted">{form.blessing.length}/600</p>
            {blessingOnly && (
              <label className="flex items-start gap-3 text-muted">
                <input type="checkbox" className="mt-1 size-5 accent-accent" checked={form.consentScreen} onChange={(e) => set("consentScreen", e.target.checked)} />
                <span>{t.consentScreenBlessing}</span>
              </label>
            )}
          </section>
        )}

        {step === "experience" && (
          <section className="space-y-6">
            <div>
              <h2 className="font-display text-[2rem] font-bold text-ink">{t.styleTitle}</h2>
              <p className="mt-1 text-muted">{t.styleHint}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(IMAGE_STYLES) as [ImageStyle, (typeof IMAGE_STYLES)[ImageStyle]][]).map(([key, style]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={form.imageStyle === key}
                  onClick={() => set("imageStyle", key)}
                  className="card flex flex-col items-start gap-1.5 p-4 text-start transition aria-pressed:border-accent aria-pressed:bg-olive-100"
                >
                  <span className="text-3xl" aria-hidden>{style.icon}</span>
                  <span className="block text-base font-bold leading-tight">{t.styles[key].label}</span>
                  <span className="block text-sm leading-snug text-muted">{t.styles[key].hint}</span>
                </button>
              ))}
            </div>
            {songsEnabled && (
              <div className="space-y-4">
                <label className="card flex items-center gap-4 p-4">
                  <input type="checkbox" className="size-5 accent-accent" checked={form.withSong} onChange={(e) => set("withSong", e.target.checked)} />
                  <span>
                    <span className="block text-lg font-bold">{t.songToggle}</span>
                    <span className="block text-sm text-muted">{t.songToggleHint(name)}</span>
                  </span>
                </label>
                {form.withSong && (
                  <fieldset>
                    <legend className="mb-3 text-muted">{t.musicLegend}</legend>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(MUSIC_STYLES) as MusicStyle[]).map((key) => (
                        <button key={key} type="button" className="chip" aria-pressed={form.musicStyle === key} onClick={() => set("musicStyle", key)}>
                          {t.musicStyles[key]}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            )}
          </section>
        )}

        {step === "photo" && (
          <section className="space-y-5">
            <div>
              <h2 className="font-display text-[2rem] font-bold text-ink">{t.photoTitle}</h2>
              <p className="mt-1 text-muted">{t.photoHint(name)}</p>
            </div>
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={preview} alt={t.photoAlt} className="aspect-square w-full rounded-3xl object-cover" />
                <button type="button" className="btn-ghost absolute bottom-3 end-3 bg-surface/90" onClick={() => setPhoto(null)}>
                  {t.photoReplace}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <PhotoInput label={t.selfie} capture onPick={setPhoto} />
                <PhotoInput label={t.gallery} onPick={setPhoto} />
              </div>
            )}
            {photo && (
              <p className="text-sm text-muted">
                {t.photoConsent(name)}
              </p>
            )}
            <label className="flex items-start gap-3 text-muted">
              <input type="checkbox" className="mt-1 size-5 accent-accent" checked={form.consentScreen} onChange={(e) => set("consentScreen", e.target.checked)} />
              <span>{t.consentScreen}</span>
            </label>
            <label className="flex items-start gap-3 text-muted">
              <input type="checkbox" className="mt-1 size-5 accent-accent" checked={form.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} />
              <span>{t.consentMarketing}</span>
            </label>
          </section>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-500/10 p-3 text-red-800">{error}</p>}

      {step !== "welcome" && (
        <footer className="sticky bottom-0 -mx-5 mt-8 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-4 pt-6">
          {step === lastStep ? (
            <button type="button" className="btn-primary w-full" disabled={submitting || !canContinue[step]} onClick={submit}>
              {submitting ? t.sending : blessingOnly ? t.sendBlessing : t.create}
            </button>
          ) : (
            <button type="button" className="btn-primary w-full" disabled={!canContinue[step] || checking} onClick={next}>
              {t.continue}
            </button>
          )}
        </footer>
      )}
    </main>
  );
}

function Question(props: { label: string; placeholder: string; value: string; max: number; rows?: number; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="font-medium">{props.label}</span>
      <textarea className="field resize-none" rows={props.rows ?? 2} maxLength={props.max} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

function PhotoInput({ label, capture, onPick }: { label: string; capture?: boolean; onPick: (f: File) => void }) {
  return (
    <label className="card flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 text-lg font-bold active:scale-[0.98]">
      {label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        {...(capture && { capture: "user" as const })}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
