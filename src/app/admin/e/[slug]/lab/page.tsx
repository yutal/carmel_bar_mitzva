import { Suspense } from "react";
import MediaLab from "@/components/MediaLab";
import { requireEventPage } from "@/lib/platform/page-auth";

export const metadata = { title: "מעבדת וידאו וקול" };

async function Inner({ params }: PageProps<"/admin/e/[slug]/lab">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "owner", `/admin/e/${slug}/lab`);
  return <MediaLab slug={slug} />;
}

export default function LabPage(props: PageProps<"/admin/e/[slug]/lab">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}
