import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Degree } from "@/generated/prisma/enums";

const DEGREES = new Set(["PROFESSIONAL_BACHELOR", "BACHELOR", "MASTER", "DOCTOR"]);

/** Специалности от регистъра на НАЦИД. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const universityId = url.searchParams.get("universityId") ?? undefined;
  const facultyId = url.searchParams.get("facultyId") ?? undefined;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const degree = url.searchParams.get("degree") ?? "";
  const items = await db.program.findMany({
    where: {
      ...(universityId ? { universityId } : {}),
      ...(facultyId ? { facultyId } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(DEGREES.has(degree) ? { degree: degree as Degree } : {}),
    },
    orderBy: [{ name: "asc" }],
    take: 50,
    select: {
      id: true,
      name: true,
      degree: true,
      degreeDetail: true,
      faculty: { select: { id: true, name: true } },
      university: { select: { id: true, shortName: true, name: true } },
    },
  });
  return NextResponse.json({ items });
}
