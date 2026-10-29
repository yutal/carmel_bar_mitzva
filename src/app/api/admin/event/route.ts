import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getEvent, saveEvent } from "@/lib/storage/event";

const Body = z.object({
  celebrantName: z.string().trim().min(1).max(40),
  celebrantNameEn: z.string().trim().max(40).default(""),
  eventTitle: z.string().trim().min(1).max(80),
  eventDate: z.string().trim().max(40),
  footer: z.string().trim().max(80),
  footerEn: z.string().trim().max(80).default(""),
  celebrantLook: z.string().trim().max(1000).default(""),
  songsEnabled: z.boolean().default(false),
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
