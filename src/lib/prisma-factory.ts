import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Използва се и от скриптове извън Next.js (импорт, seed, тестове). */
export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL не е зададен. Вижте .env.example.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
