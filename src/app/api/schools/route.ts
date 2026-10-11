import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const city = (url.searchParams.get("city") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const items = await db.school.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    },
    orderBy: [{ verified: "desc" }, { name: "asc" }],
    take: 20,
    select: { id: true, name: true, city: true, verified: true },
  });
  return NextResponse.json({ items });
}
