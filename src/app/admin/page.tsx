import { Suspense } from "react";
import AdminHome from "@/components/AdminHome";
import { requireActor } from "@/lib/platform/page-auth";
import { TOOLS } from "@/lib/platform/tools";

export const metadata = { title: "ניהול" };

async function Inner(): Promise<React.ReactElement> {
  const actor = await requireActor("/admin");
  return <AdminHome isOwner={actor.kind === "owner"} name={actor.kind === "owner" ? actor.name : actor.name} tools={TOOLS} />;
}

export default function AdminPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
