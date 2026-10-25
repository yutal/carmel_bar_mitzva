"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { PublicSubmission } from "@/lib/views";

const SLIDE_MS = 12_000;
const REFRESH_MS = 20_000;

export default function HallScreen() {
  const [items, setItems] = useState<PublicSubmission[]>([]);
  const [index, setIndex] = useState(0);
  const [qr, setQr] = useState<string>("");
  const [celebrant, setCelebrant] = useState("כרמל");

  useEffect(() => {
    void QRCode.toDataURL(location.origin, { margin: 1, width: 360, color: { dark: "#070b1f", light: "#f4d58d" } }).then(setQr);
    fetch("/api/celebrant").then((r) => r.json()).then((d: { celebrantName?: string }) => d.celebrantName && setCelebrant(d.celebrantName)).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch("/api/screen", { cache: "no-store" }).catch(() => null);
      if (alive && res?.ok) setItems((await res.json()) as PublicSubmission[]);
    }
    void load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => i + 1), SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  const item = items.length ? items[index % items.length] : undefined;
  const art = item?.image?.url ?? item?.song?.coverUrl;

  return (
    <main className="relative flex h-dvh w-full items-center gap-[4vw] overflow-hidden px-[5vw]">
      {item && art ? (
        <div key={item.publicId} className="flex h-full w-full animate-[fade_1.2s_ease] items-center gap-[4vw]">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated file served by our API */}
          <img src={art} alt="" className="h-[86vh] max-w-[46vw] rounded-[2vw] object-contain shadow-2xl shadow-black/70" />
          <div className="flex-1 space-y-[2.5vh]">
            <p className="text-[1.6vw] tracking-[0.3em] text-gold/80">
              {item.image ? "בכורה עולמית" : "שיר חדש"} · {item.fullName}
            </p>
            <h1 className="font-display text-[5vw] leading-[1.05] text-gold">{item.image?.title ?? item.song?.title}</h1>
            <p className="max-h-[40vh] overflow-hidden text-[2.1vw] leading-snug">&quot;{item.blessing}&quot;</p>
            <p className="text-[1.7vw] text-muted">{item.fullName}, {item.relationship}</p>
          </div>
        </div>
      ) : (
        <div className="w-full text-center">
          <h1 className="font-display text-[6vw] text-gold">הברכה שלך הופכת לסרט</h1>
          <p className="mt-4 text-[2.2vw] text-muted">סרקו את הקוד וכתבו ברכה ל{celebrant}</p>
        </div>
      )}
      {qr && (
        <div className="absolute bottom-[4vh] left-[3vw] flex flex-col items-center gap-2 rounded-3xl bg-night-2/80 p-4 backdrop-blur">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          <img src={qr} alt="קוד QR להשתתפות" className="size-[11vw] rounded-xl" />
          <span className="text-[1.2vw] font-bold text-gold">סרקו וכתבו ברכה</span>
        </div>
      )}
    </main>
  );
}
