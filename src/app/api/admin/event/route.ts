import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getEvent, saveEvent } from "@/lib/storage/event";

const Body = z.object({
  celebrantName: z.string().trim().min(1).max(40),
  eventTitle: z.string().trim().min(1).max(80),
  eventDate: z.string().trim().max(40),
  footer: z.string().trim().max(80),
  celebrantLook: z.string().trim().max(500).default(""),
});

export async function GET() {
  return Response.json(await getEvent(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("פרטים לא תקינים", 422);
  await saveEvent(body.data);
  return Response.json(body.data);
}
