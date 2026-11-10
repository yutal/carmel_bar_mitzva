"use client";

import { useState } from "react";

/** Post-event album designer: pick a layout, order and title, then open or download the PDF in the event's colours. */
export default function AlbumTool({ slug, layouts }: { slug: string; layouts: Record<string, string> }) {
  const [layout, setLayout] = useState("pages");
  const [order, setOrder] = useState("oldest");
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState(true);
  const q = new URLSearchParams({ layout, order, ...(title.trim() && { title: title.trim() }), ...(cover ? {} : { cover: "0" }) });
  const url = `/api/admin/e/${slug}/export/pdf?${q}`;

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 px-5 py-8">
      <a className="text-muted" href={`/admin/e/${slug}`}>→ חזרה לאירוע</a>
      <h1 className="font-display text-3xl font-bold">אלבום האירוע</h1>
      <p className="text-sm text-muted">האלבום נבנה מכל היצירות והברכות שלא הוסתרו ולא סומנו כטסט, בצבעי העיצוב של האירוע.</p>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-bold">פריסה</legend>
        {Object.entries(layouts).map(([id, label]) => (
          <label key={id} className="card flex items-center gap-3 p-4">
            <input type="radio" name="layout" className="size-5 accent-accent" checked={layout === id} onChange={() => setLayout(id)} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1">
        <span className="text-muted">סדר</span>
        <select className="field" value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="oldest">לפי סדר ההגעה</option>
          <option value="newest">מהאחרון לראשון</option>
          <option value="name">לפי שם האורח</option>
        </select>
      </label>
      <input className="field" maxLength={80} placeholder="כותרת בכריכה (ריק = שם האירוע)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} /> עמוד שער</label>
      <div className="flex gap-2">
        <a className="btn-primary flex-1" href={url} target="_blank">פתיחה / תצוגה מקדימה</a>
        <a className="btn-ghost" href={url} download>הורדה</a>
      </div>
    </main>
  );
}
