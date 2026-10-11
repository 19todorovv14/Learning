import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-factory";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
