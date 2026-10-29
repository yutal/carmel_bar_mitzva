"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { PublicSubmission } from "@/lib/views";

const REFRESH_MS = 15_000;

/** Long enough to read the blessing: 10 seconds, plus a little per letter, at most 20. */
const dwellMs = (item: PublicSubmission) => Math.min(20_000, 10_000 + item.blessing.length * 40);

/** Smaller letters for longer blessings, so the whole blessing fits on screen. */
const blessingSize = (text: string, withArt: boolean) =>
  withArt
    ? text.length < 120 ? "text-[2.4vw]" : text.length < 300 ? "text-[1.9vw]" : "text-[1.5vw]"
    : text.length < 120 ? "text-[3.4vw]" : text.length < 300 ? "text-[2.6vw]" : "text-[2vw]";

export default function HallScreen() {
  const [items, setItems] = useState<PublicSubmission[]>([]);
  // n changes on every slide, even when the same creation comes round again, so the timer always restarts.
  const [slide, setSlide] = useState<{ item: PublicSubmission; n: number } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [qr, setQr] = useState<string>("");
  const [celebrant, setCelebrant] = useState("כרמל");
  // Creations that arrived since the screen opened jump the line, so guests see theirs within a minute.
  const fresh = useRef<string[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const cursor = useRef(0);
  // Read by the slide timer, so a refresh of the list does not restart the current slide's clock.
  const itemsRef = useRef<PublicSubmission[]>([]);

  useEffect(() => {
    void QRCode.toDataURL(location.origin, { margin: 1, width: 360, color: { dark: "#2d331c", light: "#ffffff" } }).then(setQr);
    fetch("/api/celebrant").then((r) => r.json()).then((d: { celebrantName?: string }) => d.celebrantName && setCelebrant(d.celebrantName)).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch("/api/screen", { cache: "no-store" }).catch(() => null);
      if (!alive || !res?.ok) return;
      const list = (await res.json()) as PublicSubmission[];
      if (seen.current) {
        // Oldest new one first, so they play in the order they were made.
        for (const it of [...list].reverse()) if (!seen.current.has(it.publicId)) fresh.current.push(it.publicId);
      }
      seen.current = new Set(list.map((it) => it.publicId));
      itemsRef.current = list;
      setItems(list);
    }
    void load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // The next slide: a fresh creation if one is waiting, otherwise the next in the rotation.
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!hasItems) return;
    const next = () => {
      const list = itemsRef.current;
      const freshId = fresh.current.shift();
      const freshItem = freshId ? list.find((it) => it.publicId === freshId) : undefined;
      if (freshItem) {
        setIsNew(true);
        return freshItem;
      }
      setIsNew(false);
      cursor.current = (cursor.current + 1) % list.length;
      return list[cursor.current];
    };
    const t = setTimeout(() => setSlide((s) => ({ item: next(), n: (s?.n ?? 0) + 1 })), slide ? dwellMs(slide.item) : 0);
    return () => clearTimeout(t);
  }, [hasItems, slide]);

  const item = slide?.item;
  const art = item?.image?.url ?? item?.song?.coverUrl;

  return (
    <main className="relative flex h-dvh w-full items-center gap-[4vw] overflow-hidden px-[5vw]">
      {item ? (
        <div key={item.publicId} className="flex h-full w-full animate-[fade_1.2s_ease] items-center gap-[4vw]">
          {art && (
            // eslint-disable-next-line @next/next/no-img-element -- generated file served by our API
            <img src={art} alt="" className="h-[86vh] max-w-[46vw] rounded-[2vw] object-contain shadow-2xl shadow-ink/20" />
          )}
          <div className={`flex-1 space-y-[2.5vh] ${art ? "" : "mx-auto max-w-[70vw] text-center"}`}>
            <p className="text-[1.6vw] tracking-[0.3em] text-accent-soft">
              {isNew && <span className="me-3 rounded-full bg-clay px-3 py-1 text-[1.3vw] font-bold tracking-normal text-canvas">חדש!</span>}
              {item.image ? "בכורה עולמית" : item.song ? "שיר חדש" : "ברכה"} · {item.fullName}
            </p>
            {(item.image?.title ?? item.song?.title) && (
              <h1 className="font-display text-[5vw] font-bold leading-[1.05] text-ink">{item.image?.title ?? item.song?.title}</h1>
            )}
            <p dir="auto" className={`max-h-[48vh] overflow-hidden whitespace-pre-line leading-snug ${blessingSize(item.blessing, Boolean(art))}`}>
              &quot;{item.blessing}&quot;
            </p>
            <p className="text-[1.7vw] text-muted">{item.fullName}, {item.relationship}</p>
          </div>
        </div>
      ) : (
        <div className="w-full text-center">
          <p className="font-display text-[22vh] font-black leading-[0.85] text-accent-soft" aria-hidden>13</p>
          <h1 className="font-display text-[6vw] font-bold leading-none text-ink">הבר מצווה <span className="font-medium text-clay">של {celebrant}</span></h1>
          <p className="mt-6 text-[2.2vw] text-muted">סרקו את הקוד וכתבו ברכה. ה-AI יהפוך אותה ליצירה.</p>
        </div>
      )}
      {qr && (
        <div className="absolute bottom-[4vh] left-[3vw] flex flex-col items-center gap-2 rounded-3xl bg-surface p-4 backdrop-blur">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          <img src={qr} alt="קוד QR להשתתפות" className="size-[11vw] rounded-xl" />
          <span className="text-[1.2vw] font-bold text-accent">סרקו וכתבו ברכה</span>
        </div>
      )}
    </main>
  );
}
