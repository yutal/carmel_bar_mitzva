export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumePending } = await import("@/lib/pipeline/queue");
  const { scheduleGuestPhotoPurge } = await import("@/lib/storage/retention");
  const { seedCelebrantPhotos } = await import("@/lib/storage/event");
  await seedCelebrantPhotos().catch((err) => console.error("[startup] celebrant seed failed", err));
  await resumePending().catch((err) => console.error("[startup] resume failed", err));
  scheduleGuestPhotoPurge();
}
