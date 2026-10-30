import { z } from "zod";
import { jsonError } from "@/lib/http";
import { listSubmissions, updateSubmission } from "@/lib/storage/submissions";

const Body = z.object({ test: z.boolean() });

/** Marks every creation made so far as a test (or clears the mark), e.g. once the rehearsal is over. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("בקשה לא תקינה");
  const subs = await listSubmissions();
  for (const s of subs) {
    await updateSubmission(s.id, (x) => {
      x.test = body.data.test;
    });
  }
  return Response.json({ count: subs.length });
}
