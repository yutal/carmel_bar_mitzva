import { Suspense } from "react";
import GuestFlow from "@/components/GuestFlow";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<GuestFlow />}>
      <Guest searchParams={searchParams} />
    </Suspense>
  );
}

/** "Another creation" links carry the guest's name, so the flow starts at the first question, already filled in. */
async function Guest({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 60) : "");
  return params.again ? <GuestFlow again={{ fullName: one(params.name), relationship: one(params.rel) }} /> : <GuestFlow />;
}
