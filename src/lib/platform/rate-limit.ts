/**
 * Sliding-window counter, in memory. It stops one browser or address from hammering an endpoint; it is not a
 * replacement for the network-level limits of a host. Pure (the clock is a parameter) so it can be tested.
 */
export type Limiter = { hit(key: string, limit: number, windowMs: number, now?: number): { ok: boolean; retryAfterSeconds: number } };

export function createLimiter(maxKeys = 20_000): Limiter {
  const hits = new Map<string, number[]>();
  return {
    hit(key, limit, windowMs, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      return { ok: true, retryAfterSeconds: 0 };
    },
  };
}
