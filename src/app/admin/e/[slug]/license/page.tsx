import { Suspense } from "react";
import LicensePanel from "@/components/LicensePanel";
import { requireEventPage } from "@/lib/platform/page-auth";
import { TOOLS } from "@/lib/platform/tools";

export const metadata = { title: "רישיון אירוע" };

async function Inner({ params }: PageProps<"/admin/e/[slug]/license">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "owner", `/admin/e/${slug}/license`);
  return <LicensePanel slug={slug} tools={TOOLS} />;
}

export default function LicensePage(props: PageProps<"/admin/e/[slug]/license">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}
