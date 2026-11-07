import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { isSlug } from "./slug";

/**
 * Which event the current request or background job belongs to. Every event-scoped file path is resolved inside
 * this scope (see storage/fs.ts dataPath), so code that forgets to enter one fails loudly instead of reading or
 * writing another event's files. Kept on globalThis so every server bundle shares one instance.
 */
type Scope = { slug: string };
const g = globalThis as unknown as { __eventScope?: AsyncLocalStorage<Scope> };
const als = (g.__eventScope ??= new AsyncLocalStorage<Scope>());

export function withEvent<T>(slug: string, fn: () => T): T {
  if (!isSlug(slug)) throw new Error(`Invalid event slug: ${slug}`);
  return als.run({ slug }, fn);
}

/** The event of the current scope. Throws outside one: event data must never be touched without knowing whose it is. */
export function currentSlug(): string {
  const slug = als.getStore()?.slug;
  if (!slug) throw new Error("No event scope: wrap the call in withEvent()");
  return slug;
}

export function maybeSlug(): string | undefined {
  return als.getStore()?.slug;
}

/**
 * Captures the current event so a callback that runs later (a queue task, a timer) runs in the same event.
 * Queues start the next task from the previous task's context, so this is required, not an optimisation.
 */
export function bindEvent<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const slug = currentSlug();
  return (...args: A) => withEvent(slug, () => fn(...args));
}
