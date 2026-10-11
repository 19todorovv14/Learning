import type { Instrumentation } from "next";

/** Записва сървърните грешки в ErrorLog (без лични данни — само съобщение, стек и път). */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("@/lib/audit");
  const e = err as Error & { digest?: string };
  await logError(e.message ?? String(err), { stack: e.stack, path: request.path, digest: e.digest });
};
