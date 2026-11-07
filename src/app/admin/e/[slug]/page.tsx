import { Suspense } from "react";
import AdminDashboard from "@/components/AdminDashboard";
import { requireEventPage } from "@/lib/platform/page-auth";

export const metadata = { title: "ניהול אירוע" };

async function Inner({ params }: PageProps<"/admin/e/[slug]">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "view", `/admin/e/${slug}`);
  return <AdminDashboard slug={slug} />;
}

export default function AdminPage(props: PageProps<"/admin/e/[slug]">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}
