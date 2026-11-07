import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getPlatform } from "@/lib/platform/events";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense>
      <Root searchParams={searchParams} />
    </Suspense>
  );
}

/** The site root opens the default event, so QR codes printed before events existed keep working. */
async function Root({ searchParams }: Pick<PageProps<"/">, "searchParams">): Promise<React.ReactElement> {
  await connection();
  const { defaultEvent } = await getPlatform();
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query.set(k, v);
  if (!defaultEvent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5 text-center">
        <p className="text-lg text-muted">אין כרגע אירוע פעיל בכתובת הזאת.</p>
      </main>
    );
  }
  redirect(`/e/${defaultEvent}${query.size ? `?${query}` : ""}`);
}
