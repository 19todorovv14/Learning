import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "./env";

/** Проверка на Authorization: Bearer <CRON_SECRET> (сравнение с постоянно време). Без валиден секрет — отказ. */
export function cronAuthorized(req: Request) {
  const { value } = cronSecret();
  if (!value) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${value}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
