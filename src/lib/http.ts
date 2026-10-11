import "server-only";
import { NextResponse } from "next/server";

/** Защита от CSRF за route handlers: заявката трябва да идва от същия произход. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host;
  } catch {
    return false;
  }
}

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}
