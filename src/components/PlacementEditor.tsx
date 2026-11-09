"use client";

import { useRef, useState } from "react";
import { ELEMENT_IDS, ELEMENTS, PlacementSchema, SIZE_SHARE, type Deliverable, type ElementId, type Placement } from "@/lib/platform/design-brief";
import { themeWrapperStyle, type Theme } from "@/lib/platform/theme-rules";

type Elements = Deliverable["elements"];
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const round = (n: number) => Math.round(n * 1000) / 1000;
const SIZE_LABEL = { s: "קטן", m: "בינוני", l: "גדול" } as const;
const ALIGN_LABEL = { start: "להתחלה", center: "למרכז", end: "לסוף" } as const;

/**
 * The frame of one piece, in the event's colours and fonts, with the items on it as boxes the organiser drags to where
 * they should go. What is stored is the centre of each item as a fraction of the frame, so it means the same on a
 * magnet, a sign or a phone. Keyboard: focus an item and use the arrow keys (shift for bigger steps).
 */
export default function PlacementEditor({
  aspect,
  elements,
  texts,
  theme,
  logoSrc,
  onChange,
}: {
  aspect: number;
  elements: Elements;
  texts: { title: string; date: string; venue: string };
  theme: Theme;
  logoSrc?: string;
  onChange: (next: Elements) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef<ElementId | null>(null);
  const [selected, setSelected] = useState<ElementId | null>(null);

  const put = (id: ElementId, p: Placement) => onChange({ ...elements, [id]: p });
  const sel = selected ? elements[selected] : undefined;

  function move(e: React.PointerEvent) {
    const id = dragging.current;
    const box = frame.current?.getBoundingClientRect();
    if (!id || !box || !elements[id]) return;
    put(id, { ...elements[id]!, x: round(clamp((e.clientX - box.left) / box.width)), y: round(clamp((e.clientY - box.top) / box.height)) });
  }
  function key(e: React.KeyboardEvent, id: ElementId) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    const p = elements[id];
    if (!d || !p) return;
    e.preventDefault();
    put(id, { ...p, x: round(clamp(p.x + d[0])), y: round(clamp(p.y + d[1])) });
  }
  function toggle(id: ElementId) {
    const next = { ...elements };
    if (next[id]) {
      delete next[id];
      if (selected === id) setSelected(null);
    } else {
      next[id] = PlacementSchema.parse(ELEMENTS[id].at);
      setSelected(id);
    }
    onChange(next);
  }

  const textOf = (id: ElementId) => (id === "title" ? texts.title : id === "date" ? texts.date : id === "venue" ? texts.venue : "") || ELEMENTS[id].label;

  return (
    <div className="space-y-3">
      <div
        ref={frame}
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-line"
        style={{ ...themeWrapperStyle(theme), minHeight: undefined, aspectRatio: String(aspect), maxWidth: aspect >= 1 ? "32rem" : `${((22 * aspect) / 0.67).toFixed(1)}rem`, containerType: "inline-size" }}
        onPointerMove={move}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <div className="pointer-events-none absolute inset-[4%] rounded-sm border border-dashed" style={{ borderColor: "color-mix(in srgb, var(--color-ink) 18%, transparent)" }} aria-hidden />
        {ELEMENT_IDS.map((id) => {
          const p = elements[id];
          if (!p) return null;
          const el = ELEMENTS[id];
          const share = SIZE_SHARE[el.text ? "text" : "picture"][p.size];
          const on = selected === id;
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`${el.label}: גררו או השתמשו בחצים`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragging.current = id;
                setSelected(id);
              }}
              onKeyDown={(e) => key(e, id)}
              onFocus={() => setSelected(id)}
              className="absolute cursor-grab touch-none select-none rounded-md px-1 text-center leading-tight outline-none active:cursor-grabbing focus-visible:ring-2"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                transform: "translate(-50%, -50%)",
                maxWidth: "90%",
                outline: `1.5px ${on ? "solid" : "dashed"} var(--color-accent)`,
                background: on ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : undefined,
                textAlign: p.align === "center" ? "center" : p.align === "start" ? "start" : "end",
                ...(el.text
                  ? { width: "max-content", fontSize: `${(share / aspect) * 0.75}cqw`, fontFamily: id === "title" ? "var(--font-display)" : "var(--font-sans)", fontWeight: id === "title" ? 700 : 500 }
                  : { width: `${share}%`, aspectRatio: "1", display: "grid", placeItems: "center", fontSize: "3cqw" }),
              }}
            >
              {id === "logo" && logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- the organiser's own uploaded logo
                <img src={logoSrc} alt="" className="pointer-events-none max-h-full max-w-full object-contain" draggable={false} />
              ) : id === "qr" ? (
                <span className="grid size-full place-items-center border-2 border-current font-bold">QR</span>
              ) : (
                textOf(id)
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="מה מופיע בעיצוב">
        {ELEMENT_IDS.map((id) => (
          <button key={id} type="button" className="chip !px-3 !py-1.5 text-sm" aria-pressed={Boolean(elements[id])} onClick={() => toggle(id)}>
            {ELEMENTS[id].label}
          </button>
        ))}
      </div>

      {selected && sel && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-olive-100 p-3 text-sm">
          <span className="font-bold">{ELEMENTS[selected].label}</span>
          <span className="text-muted">גודל</span>
          {(["s", "m", "l"] as const).map((s) => (
            <button key={s} type="button" className="chip !px-3 !py-1 text-sm" aria-pressed={sel.size === s} onClick={() => put(selected, { ...sel, size: s })}>{SIZE_LABEL[s]}</button>
          ))}
          {ELEMENTS[selected].text && (
            <>
              <span className="text-muted">יישור</span>
              {(["start", "center", "end"] as const).map((a) => (
                <button key={a} type="button" className="chip !px-3 !py-1 text-sm" aria-pressed={sel.align === a} onClick={() => put(selected, { ...sel, align: a })}>{ALIGN_LABEL[a]}</button>
              ))}
            </>
          )}
          <span className="text-muted">{Math.round(sel.x * 100)}% משמאל · {Math.round(sel.y * 100)}% מלמעלה</span>
        </div>
      )}
    </div>
  );
}
