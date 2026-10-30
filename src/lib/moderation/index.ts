import "server-only";
import { providers } from "@/lib/providers";
import type { GuestInput } from "@/lib/types";
import { harshWords } from "./words";

/** The answers a guest types, in the order of the form. The name and relationship count too: they end up on the poster. */
const FIELDS = ["fullName", "relationship", "together", "memory", "talent", "blessing"] as const;
export type TextField = (typeof FIELDS)[number];

/**
 * Looks for clearly inappropriate text before anything is created: first the harsh-word list (instant, both
 * languages), then the moderation model for meaning. Returns the first field that fails, or undefined.
 * If the model cannot be reached the guest is let through: the analysis stage still reads the text, and a
 * hiccup must not stop a guest at the event.
 */
export async function inappropriateField(input: Pick<GuestInput, TextField>): Promise<TextField | undefined> {
  const filled = FIELDS.filter((f) => input[f].trim());
  const harsh = filled.find((f) => harshWords(input[f]).length);
  if (harsh) return harsh;
  try {
    const flagged = await providers.llm.moderate(filled.map((f) => input[f]));
    const at = flagged.findIndex(Boolean);
    return at < 0 ? undefined : filled[at];
  } catch (err) {
    console.error("[moderation] check failed, letting the text through", err);
    return undefined;
  }
}
