import { Suspense } from "react";
import GuestFlow from "@/components/GuestFlow";
import { isLang } from "@/lib/i18n";

export default function EventHome({ params, searchParams }: PageProps<"/e/[slug]">) {
  return (
    <Suspense>
      <Guest params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** ?lang=en switches the guest pages to English. "Another creation" links carry the guest's name, so the flow starts at the first question, already filled in. */
async function Guest({ params, searchParams }: Pick<PageProps<"/e/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const query = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 60) : "");
  const lang = isLang(query.lang) ? query.lang : "he";
  // The key resets the form when the guest switches language on the welcome screen.
  return query.again ? (
    <GuestFlow key={lang} slug={slug} lang={lang} again={{ fullName: one(query.name), relationship: one(query.rel) }} />
  ) : (
    <GuestFlow key={lang} slug={slug} lang={lang} />
  );
}
