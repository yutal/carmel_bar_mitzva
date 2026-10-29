import { getChoir, startChoir } from "@/lib/lab/choir";

export async function GET() {
  return Response.json({ choir: (await getChoir()) ?? null }, { headers: { "Cache-Control": "no-store" } });
}

/** Builds the "mazal tov choir" from every finished lab recording. */
export async function POST() {
  return Response.json({ choir: await startChoir() }, { status: 202 });
}
