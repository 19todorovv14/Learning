import { createHash, randomBytes } from "node:crypto";

/** Случаен токен (base32, 160 бита) — изпраща се към клиента. */
export function generateToken(bytes = 20) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const buf = randomBytes(bytes);
  let out = "";
  for (const b of buf) out += alphabet[b & 31];
  // 5 бита на байт → добавяме още ентропия, за да е над 160 бита
  const extra = randomBytes(bytes);
  for (const b of extra) out += alphabet[b & 31];
  return out;
}

/** В базата пазим само SHA-256 хеш на токена. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
