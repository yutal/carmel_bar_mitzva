import { Suspense } from "react";
import AlbumTool from "@/components/AlbumTool";
import { requireEventPage } from "@/lib/platform/page-auth";
import { ALBUM_LAYOUTS } from "@/lib/compose/album";

export const metadata = { title: "אלבום האירוע" };

export default function AlbumPage(props: PageProps<"/admin/e/[slug]/album">) {
  return (
    <Suspense>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params }: PageProps<"/admin/e/[slug]/album">): Promise<React.ReactElement> {
  const { slug } = await params;
  await requireEventPage(slug, "manage", `/admin/e/${slug}/album`);
  return <AlbumTool slug={slug} layouts={ALBUM_LAYOUTS} />;
}
