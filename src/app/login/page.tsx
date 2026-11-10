import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "כניסה" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense>
      <Form searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  // Only paths inside the site: a login link must never send someone to another address afterwards.
  const target = typeof next === "string" && /^\/(?!\/)[^\\]*$/.test(next) ? next : "/admin";
  return <LoginForm next={target} />;
}
