import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Регистрация" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Създай профил</h1>
      <p className="mt-2 text-sm text-muted">Безплатно. Отнема по-малко от минута.</p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        Вече имаш профил?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Влез
        </Link>
      </p>
    </>
  );
}
