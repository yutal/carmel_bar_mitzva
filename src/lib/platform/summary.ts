import "server-only";
import { queueStats } from "@/lib/pipeline/queue";
import { getEvent } from "@/lib/storage/event";
import { listSubmissions } from "@/lib/storage/submissions";
import { getLicense, licenseUsage } from "./license";
import { BLOCK_ADMIN, licenseBlock } from "./license-rules";
import { listEventSlugs } from "./events";
import { can, type Actor } from "./roles";
import { withEvent } from "./scope";

/** One row on the admin home page. */
export type EventSummary = {
  slug: string;
  title: string;
  celebrantName: string;
  date: string;
  mode: "celebrant" | "open";
  tools: string[];
  role: string;
  open: boolean;
  reason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  creations: number;
  maxCreations: number;
  blessings: number;
  queue: { waiting: number; running: number };
};

export async function eventSummaries(actor: Actor): Promise<EventSummary[]> {
  const slugs = (await listEventSlugs()).filter((s) => can(actor, s, "view"));
  return Promise.all(
    slugs.map((slug) =>
      withEvent(slug, async () => {
        const [ev, lic, usage, subs] = await Promise.all([getEvent(), getLicense(), licenseUsage(), listSubmissions()]);
        const block = licenseBlock(lic, "blessings", usage, Date.now(), { creating: true });
        return {
          slug,
          title: ev.eventTitle || slug,
          celebrantName: ev.celebrantName,
          date: ev.eventDate,
          mode: lic.mode,
          tools: lic.tools,
          role: actor.kind === "owner" ? "owner" : actor.events[slug],
          open: !block,
          reason: block ? BLOCK_ADMIN[block] : null,
          startsAt: lic.startsAt,
          endsAt: lic.endsAt,
          creations: usage.creations,
          maxCreations: lic.maxCreations,
          blessings: subs.filter((s) => !s.test).length,
          queue: queueStats(),
        };
      }),
    ),
  );
}
