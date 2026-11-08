import { Suspense } from "react";
import GatePanel from "@/components/GatePanel";
import { requireEventPage } from "@/lib/platform/page-auth";

export const metadata = { title: "שער כניסה" };

export default function GatePage(props: PageProps<"/admin/e/[slug]/gate">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params }: PageProps<"/admin/e/[slug]/gate">): Promise<React.ReactElement> {
  const { slug } = await params;
  const actor = await requireEventPage(slug, "manage", `/admin/e/${slug}/gate`);
  return <GatePanel slug={slug} isOwner={actor.kind === "owner"} />;
}
