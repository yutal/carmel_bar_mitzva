/** Event slugs: the part of the URL after /e/. Lower-case Latin letters, digits and hyphens, 2 to 40 characters. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_RE.test(value);
}

/**
 * A guest's public id carries the event: "<slug>.<random>". The random part is base64url, which never contains a
 * dot, and slugs never do either. Ids made before events existed have no dot and belong to the legacy event.
 */
export function splitPublicId(publicId: string): { slug?: string; token: string } | undefined {
  if (!/^[A-Za-z0-9_.-]{8,80}$/.test(publicId)) return undefined;
  const dot = publicId.indexOf(".");
  if (dot === -1) return { token: publicId };
  const slug = publicId.slice(0, dot);
  const token = publicId.slice(dot + 1);
  if (!isSlug(slug) || !token || token.includes(".")) return undefined;
  return { slug, token };
}
