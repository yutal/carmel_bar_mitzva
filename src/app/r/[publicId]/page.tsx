import { Suspense } from "react";
import ResultView from "@/components/ResultView";
import { isLang } from "@/lib/i18n";
import { eventOfPublicId } from "@/lib/platform/events";
import { withEvent } from "@/lib/platform/scope";
import { DEFAULT_THEME, themeWrapperStyle } from "@/lib/platform/theme-rules";
import { getTheme } from "@/lib/storage/theme";

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
  // The result page wears the theme of the event the guest's link belongs to.
  const slug = await eventOfPublicId(publicId);
  const theme = slug ? await withEvent(slug, getTheme) : undefined;
  // ?lang only covers the first moment; once loaded, the page follows the language the guest wrote in.
  return (
    <div data-theme-root style={themeWrapperStyle(theme ?? DEFAULT_THEME)}>
      <ResultView publicId={publicId} initialLang={isLang(lang) ? lang : "he"} />
    </div>
  );
}
