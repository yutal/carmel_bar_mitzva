"use client";

import { useState } from "react";

export default function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }).catch(() => null);
    if (res?.ok) {
      location.href = next;
      return;
    }
    setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "שגיאת רשת");
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-5">
      <h1 className="font-display text-3xl font-bold">כניסה לניהול</h1>
      <form onSubmit={submit} className="space-y-4">
        <input className="field" dir="ltr" autoComplete="username" placeholder="שם משתמש" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="field" dir="ltr" type="password" autoComplete="current-password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-800" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !username || !password}>{busy ? "נכנס..." : "כניסה"}</button>
      </form>
    </main>
  );
}
