import { Suspense } from "react";
import QaPanel from "@/components/QaPanel";
import { requireEventPage } from "@/lib/platform/page-auth";

export const metadata = { title: "בדיקת סגנונות" };

async function Inner({ params }: PageProps<"/admin/e/[slug]/qa">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "owner", `/admin/e/${slug}/qa`);
  return <QaPanel slug={slug} />;
}

export default function QaPage(props: PageProps<"/admin/e/[slug]/qa">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}
