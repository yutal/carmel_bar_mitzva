/**
 * What each role may do in an event it was given. The platform owner may do everything everywhere.
 *   view      see the dashboard, creations and blessings
 *   moderate  hide or show, mark as test, regenerate, run the print queue
 *   manage    event details, celebrant photos, theme, exports and the album
 *   owner     licence, accounts, the video lab and the style check (they expose prompts and cost money)
 */
export const ROLES = {
  manager: { label: "מנהל אירוע", perms: ["view", "moderate", "manage"] },
  staff: { label: "צוות / מפעיל עמדה", perms: ["view", "moderate"] },
  viewer: { label: "צפייה בלבד", perms: ["view"] },
} as const;
export type Role = keyof typeof ROLES;
export const ROLE_IDS = Object.keys(ROLES) as [Role, ...Role[]];

export type Perm = "view" | "moderate" | "manage" | "owner";

export type Actor =
  | { kind: "owner"; name: string }
  | { kind: "operator"; id: string; username: string; name: string; events: Record<string, Role> };

export function can(actor: Actor | null | undefined, slug: string, perm: Perm): boolean {
  if (!actor) return false;
  if (actor.kind === "owner") return true;
  if (perm === "owner") return false;
  const role = actor.events[slug];
  return Boolean(role && (ROLES[role].perms as readonly string[]).includes(perm));
}

/** The event permissions an actor has, for the pages to show or hide controls. The server checks again on every call. */
export function permsFor(actor: Actor, slug: string): Perm[] {
  return (["view", "moderate", "manage", "owner"] as const).filter((p) => can(actor, slug, p));
}
