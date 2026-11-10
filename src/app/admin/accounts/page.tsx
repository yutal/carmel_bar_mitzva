import { Suspense } from "react";
import AccountsPanel from "@/components/AccountsPanel";
import { requireActor } from "@/lib/platform/page-auth";
import { notFound } from "next/navigation";
import { ROLES } from "@/lib/platform/roles";

export const metadata = { title: "הרשאות" };

async function Inner(): Promise<React.ReactElement> {
  const actor = await requireActor("/admin/accounts");
  if (actor.kind !== "owner") notFound();
  return <AccountsPanel roles={Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.label]))} />;
}

export default function AccountsPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
