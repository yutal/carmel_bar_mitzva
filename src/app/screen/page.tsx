import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getPlatform } from "@/lib/platform/events";

export default function ScreenRedirect() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  );
}

/** The default event's hall screen, at the address it had before events existed. */
async function Go(): Promise<React.ReactElement> {
  await connection();
  const { defaultEvent } = await getPlatform();
  if (!defaultEvent) notFound();
  redirect(`/e/${defaultEvent}/screen`);
}
