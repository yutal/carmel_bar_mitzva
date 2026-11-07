import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eventExists } from "@/lib/platform/events";

/** Every guest page of one event. An unknown slug is a 404. */
export default function EventLayout({ children, params }: LayoutProps<"/e/[slug]">) {
  return (
    <Suspense>
      <Gate params={params}>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children, params }: { children: React.ReactNode; params: LayoutProps<"/e/[slug]">["params"] }) {
  const { slug } = await params;
  if (!(await eventExists(slug))) notFound();
  return <div data-theme-root>{children}</div>;
}
