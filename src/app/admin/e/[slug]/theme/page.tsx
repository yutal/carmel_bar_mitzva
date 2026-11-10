import { Suspense } from "react";
import ThemePanel from "@/components/ThemePanel";
import { requireEventPage } from "@/lib/platform/page-auth";

export const metadata = { title: "עיצוב האירוע" };

export default function ThemePage(props: PageProps<"/admin/e/[slug]/theme">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params }: PageProps<"/admin/e/[slug]/theme">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "manage", `/admin/e/${slug}/theme`);
  return <ThemePanel slug={slug} />;
}
