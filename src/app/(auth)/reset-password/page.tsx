import type { Metadata } from "next";
import Link from "next/link";
import { peekEmailToken } from "@/lib/auth/service";
import { Alert } from "@/components/ui/misc";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Нова парола" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const valid = token ? await peekEmailToken(token, "RESET_PASSWORD") : false;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Нова парола</h1>
      <div className="mt-8">
        {valid ? (
          <ResetForm token={token} />
        ) : (
          <Alert kind="error" title="Линкът е невалиден или е изтекъл">
            <Link href="/forgot-password" className="underline">
              Заяви нов линк
            </Link>
          </Alert>
        )}
      </div>
    </>
  );
}
