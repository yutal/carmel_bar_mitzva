import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eventExists } from "@/lib/platform/events";
import { withEvent } from "@/lib/platform/scope";
import { themeVars } from "@/lib/platform/theme-rules";
import { getTheme } from "@/lib/storage/theme";

/** Every guest page of one event, wearing that event's theme. An unknown slug is a 404. */
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
  const theme = await withEvent(slug, getTheme);
  // The theme is CSS variables on this wrapper only: another event open on another phone, or in another tab, is untouched.
  return (
    <div data-theme-root style={{ ...themeVars(theme), background: "var(--color-canvas)", color: "var(--color-ink)", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
