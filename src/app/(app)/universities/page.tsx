import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Университети и академии" };

export default async function UniversitiesPage({ searchParams }: PageProps<"/universities">) {
  const sp = await searchParams;
  const city = typeof sp.city === "string" ? sp.city : "";
  const own = sp.own === "STATE" || sp.own === "PRIVATE" ? sp.own : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const [all, unis] = await Promise.all([
    db.university.findMany({ select: { city: true } }),
    db.university.findMany({
      where: {
        ...(city ? { city } : {}),
        ...(own ? { ownership: own } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { shortName: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { programs: { where: { degree: { in: ["BACHELOR", "PROFESSIONAL_BACHELOR", "MASTER"] } } }, faculties: true } } },
    }),
  ]);
  const cities = [...new Set(all.map((u) => u.city))].sort((a, b) => a.localeCompare(b, "bg"));

  return (
    <>
      <PageHeader
        kicker="Висше образование"
        title="Университети и академии"
        description="Всички 51 висши училища от регистъра на НАЦИД с факултетите и специалностите им. Данните за специалностите са официални; условията за прием проверявай на сайта на съответното училище."
      />
      <form method="get" className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_200px_200px_auto]">
        <input name="q" defaultValue={q} className="input" placeholder="Търси по име…" aria-label="Търсене" />
        <select name="city" defaultValue={city} className="input" aria-label="Град">
          <option value="">Всички градове</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="own" defaultValue={own} className="input" aria-label="Собственост">
          <option value="">Държавни и частни</option>
          <option value="STATE">Държавни</option>
          <option value="PRIVATE">Частни</option>
        </select>
        <button className="btn-primary">Филтрирай</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {unis.map((u) => (
          <Link key={u.id} href={`/universities/${u.slug}`} className="card group p-5 hover:shadow-pop">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium group-hover:text-primary">{u.name}</div>
              {u.shortName && <span className="badge shrink-0 bg-surface-3 text-text-2">{u.shortName}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {u.city}
              </span>
              <span>{u.ownership === "STATE" ? "държавно" : "частно"}</span>
              <span>{plural(u._count.programs, "специалност", "специалности")} (бакалавър/магистър)</span>
              {u._count.faculties > 0 && <span>{plural(u._count.faculties, "факултет", "факултета")}</span>}
              {u.verifiedAt && (
                <span className="inline-flex items-center gap-1 text-success">
                  <BadgeCheck className="h-3.5 w-3.5" /> сайтът е проверен
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
