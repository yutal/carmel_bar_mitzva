import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eventExists } from "./events";
import { can, type Actor, type Perm } from "./roles";
import { actorFromToken, SESSION_COOKIE } from "./session";
import { isSlug } from "./slug";

/** For admin pages: the signed-in person, or a redirect to the login page. */
export async function requireActor(next: string): Promise<Actor> {
  const actor = await actorFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!actor) redirect(`/login?next=${encodeURIComponent(next)}`);
  return actor;
}

/** For event admin pages: 404 when the event is missing or not theirs, the same answer either way. */
export async function requireEventPage(slug: string, perm: Perm, next: string): Promise<Actor> {
  const actor = await requireActor(next);
  if (!isSlug(slug) || !can(actor, slug, "view") || !(await eventExists(slug))) notFound();
  if (!can(actor, slug, perm)) notFound();
  return actor;
}
