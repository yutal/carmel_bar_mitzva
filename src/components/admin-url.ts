/**
 * The event admin pages call /api/admin/<thing>; this turns that into /api/admin/e/<slug>/<thing> for the event the
 * page was opened for. One admin page shows one event, so a module-level slug is enough; each page sets it first.
 */
let slug = "";
export function setAdminSlug(s: string): void {
  slug = s;
}
export const adminSlug = () => slug;
export function adminUrl(url: string): string {
  return url.startsWith("/api/admin/") ? url.replace("/api/admin/", `/api/admin/e/${slug}/`) : url;
}
