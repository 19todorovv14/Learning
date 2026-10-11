import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Търсене в Списъка на професиите (СППОО-2024 и СППОО-2003). */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ professions: [], specialties: [] });
  const byCode = /^\d{3,7}$/.test(q);
  const [professions, specialties] = await Promise.all([
    db.vocationalProfession.findMany({
      where: byCode ? { code: { startsWith: q } } : { name: { contains: q, mode: "insensitive" } },
      orderBy: [{ listVersion: "desc" }, { name: "asc" }],
      take: 15,
      select: { id: true, code: true, name: true, listVersion: true, area: { select: { name: true } } },
    }),
    db.vocationalSpecialty.findMany({
      where: byCode ? { code: { startsWith: q } } : { name: { contains: q, mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: 15,
      select: { id: true, code: true, name: true, profession: { select: { id: true, name: true, code: true } } },
    }),
  ]);
  return NextResponse.json({ professions, specialties });
}
