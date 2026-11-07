export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { eventExists, migrateLegacyLayout } = await import("@/lib/platform/events");
  const { withEvent } = await import("@/lib/platform/scope");
  const { config } = await import("@/lib/config");
  const { resumePending } = await import("@/lib/pipeline/queue");
  const { scheduleGuestPhotoPurge } = await import("@/lib/storage/retention");
  const { seedCelebrantPhotos } = await import("@/lib/storage/event");
  const { resumeLab } = await import("@/lib/lab/jobs");
  const { authSecret } = await import("@/lib/platform/secret");
  // Moves a single-event installation into events/<DEFAULT_EVENT_SLUG>/ before anything reads the data.
  await migrateLegacyLayout().catch((err) => console.error("[startup] event migration failed", err));
  try {
    authSecret();
  } catch (err) {
    console.error("[startup] auth secret unavailable", err);
  }
  if (await eventExists(config.defaultEventSlug)) {
    await withEvent(config.defaultEventSlug, () => seedCelebrantPhotos()).catch((err) => console.error("[startup] celebrant seed failed", err));
  }
  await resumePending().catch((err) => console.error("[startup] resume failed", err));
  await resumeLab().catch((err) => console.error("[startup] lab resume failed", err));
  scheduleGuestPhotoPurge();
}
