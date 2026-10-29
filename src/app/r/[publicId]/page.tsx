import { Suspense } from "react";
import ResultView from "@/components/ResultView";
import { isLang } from "@/lib/i18n";

export default function ResultPage({ params, searchParams }: PageProps<"/r/[publicId]">) {
  return (
    <Suspense>
      <Result params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Result({ params, searchParams }: Pick<PageProps<"/r/[publicId]">, "params" | "searchParams">) {
  const { publicId } = await params;
  const { lang } = await searchParams;
  // ?lang only covers the first moment; once loaded, the page follows the language the guest wrote in.
  return <ResultView publicId={publicId} initialLang={isLang(lang) ? lang : "he"} />;
}
