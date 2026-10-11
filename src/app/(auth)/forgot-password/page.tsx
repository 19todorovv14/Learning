import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Забравена парола" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Забравена парола</h1>
      <p className="mt-2 text-sm text-muted">Въведи имейла си и ще ти изпратим линк за нова парола.</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          ← Обратно към вход
        </Link>
      </p>
    </>
  );
}
