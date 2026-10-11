import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Добре дошъл отново</h1>
      <p className="mt-2 text-sm text-muted">Влез, за да продължиш оттам, откъдето спря.</p>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        Нямаш профил?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Създай безплатно
        </Link>
      </p>
    </>
  );
}
