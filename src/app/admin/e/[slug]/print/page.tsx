import { Suspense } from "react";
import PrintQueue from "@/components/PrintQueue";
import { requireEventPage } from "@/lib/platform/page-auth";

export const metadata = { title: "הדפסה" };

export default function PrintPage(props: PageProps<"/admin/e/[slug]/print">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params }: PageProps<"/admin/e/[slug]/print">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "moderate", `/admin/e/${slug}/print`);
  return <PrintQueue slug={slug} />;
}
