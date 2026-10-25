export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumePending } = await import("@/lib/pipeline/queue");
  await resumePending().catch((err) => console.error("[startup] resume failed", err));
}
