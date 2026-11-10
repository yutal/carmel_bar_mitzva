import { Suspense } from "react";
import DesignBriefPanel from "@/components/DesignBriefPanel";
import { requireEventPage } from "@/lib/platform/page-auth";

export const metadata = { title: "בריף עיצוב" };

export default function DesignPage(props: PageProps<"/admin/e/[slug]/design">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params }: PageProps<"/admin/e/[slug]/design">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "manage", `/admin/e/${slug}/design`);
  return <DesignBriefPanel slug={slug} />;
}
