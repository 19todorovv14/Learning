import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailWithToken } from "@/lib/auth/service";
import { getCurrentUser } from "@/lib/auth/session";
import { Alert } from "@/components/ui/misc";
import { ResendVerification } from "./resend";

export const metadata: Metadata = { title: "Потвърждение на имейл" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const user = await getCurrentUser();

  if (token) {
    const userId = await verifyEmailWithToken(token);
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Потвърждение на имейл</h1>
        <div className="mt-8 space-y-6">
          {userId ? (
            <Alert kind="success" title="Имейлът е потвърден!">
              Благодарим ти. Профилът ти е напълно активен.
            </Alert>
          ) : (
            <Alert kind="error" title="Линкът е невалиден или вече е използван">
              Ако вече си потвърдил имейла, всичко е наред.
            </Alert>
          )}
          <Link href={user ? "/dashboard" : "/login"} className="btn-primary w-full py-3">
            {user ? "Към моето обучение" : "Вход"}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Потвърди имейла си</h1>
      <p className="mt-2 text-sm text-muted">
        Изпратихме ти писмо с линк за потвърждение. Ако не го виждаш, провери папка „Спам“.
      </p>
      <div className="mt-8">
        {user ? (
          user.emailVerified ? (
            <Alert kind="success">Имейлът ти вече е потвърден.</Alert>
          ) : (
            <ResendVerification />
          )
        ) : (
          <Link href="/login" className="btn-primary w-full">
            Вход
          </Link>
        )}
      </div>
    </>
  );
}
