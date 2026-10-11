import "server-only";
import { headers } from "next/headers";
import { hashToken } from "@/lib/auth/crypto";

/** Хеш на IP адреса (не съхраняваме суровия адрес). */
export async function clientKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return hashToken(`ip:${ip}`).slice(0, 32);
}
