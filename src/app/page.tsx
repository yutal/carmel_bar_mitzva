import { Suspense } from "react";
import GuestFlow from "@/components/GuestFlow";
import { isLang } from "@/lib/i18n";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<GuestFlow />}>
      <Guest searchParams={searchParams} />
    </Suspense>
  );
}

/** ?lang=en switches the guest pages to English. "Another creation" links carry the guest's name, so the flow starts at the first question, already filled in. */
async function Guest({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 60) : "");
  const lang = isLang(params.lang) ? params.lang : "he";
  // The key resets the form when the guest switches language on the welcome screen.
  return params.again ? (
    <GuestFlow key={lang} lang={lang} again={{ fullName: one(params.name), relationship: one(params.rel) }} />
  ) : (
    <GuestFlow key={lang} lang={lang} />
  );
}
