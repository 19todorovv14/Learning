import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Degree, HigherEdType } from "@/generated/prisma/enums";
import { slugify } from "@/lib/utils";

type NacidData = {
  source: { title: string; organization: string; url: string; fetchedAt: string };
  universities: { nacidId: number; name: string; nameEn: string }[];
  programs: {
    university: string;
    faculty: string | null;
    name: string;
    nameEn: string | null;
    degree: string;
    field: string | null;
    forms: string[];
    durations: number[];
    languages: string[];
    regulated: boolean;
  }[];
};

type UniMeta = {
  name: string;
  slug: string;
  short?: string;
  city: string;
  ownership: "STATE" | "PRIVATE";
  website?: string;
  checked?: boolean;
};

const DEGREE: Record<string, { degree: Degree; detail?: string }> = {
  profBachelor: { degree: "PROFESSIONAL_BACHELOR" },
  bachelor: { degree: "BACHELOR" },
  masterHigh: { degree: "MASTER", detail: "Магистър след висше образование" },
  masterSecondary: { degree: "MASTER", detail: "Магистър след средно образование" },
  doctor: { degree: "DOCTOR" },
};

function typeFromName(name: string): HigherEdType {
  if (/университет/i.test(name)) return "UNIVERSITY";
  if (/колеж/i.test(name)) return "INDEPENDENT_COLLEGE";
  return "SPECIALIZED_HIGHER_SCHOOL";
}

export async function importUniversities(db: PrismaClient, root: string, log: (msg: string) => void = () => {}) {
  const data = JSON.parse(readFileSync(join(root, "universities/nacid-register.json"), "utf8")) as NacidData;
  const meta = parseYaml(readFileSync(join(root, "universities/universities.yaml"), "utf8")) as UniMeta[];
  const metaByName = new Map(meta.map((m) => [m.name, m]));
  const fetchedAt = new Date(data.source.fetchedAt);

  const source = await db.source.upsert({
    where: { url: data.source.url },
    create: {
      key: "nacid-rvu",
      title: data.source.title,
      organization: data.source.organization,
      url: data.source.url,
      type: "REGISTER",
      freshness: "CURRENT",
      verifiedAt: fetchedAt,
      lastHttpStatus: 200,
      verificationNote: "Данните за висшите училища и специалностите са изтеглени от публичния регистър на НАЦИД.",
    },
    update: { verifiedAt: fetchedAt, freshness: "CURRENT", lastHttpStatus: 200 },
  });

  const uniIds = new Map<string, string>();
  for (const u of data.universities) {
    const m = metaByName.get(u.name);
    if (!m) {
      log(`⚠ няма метаданни за „${u.name}“`);
      continue;
    }
    const row = await db.university.upsert({
      where: { slug: m.slug },
      create: {
        slug: m.slug,
        nacidId: u.nacidId,
        name: u.name,
        nameEn: u.nameEn,
        shortName: m.short ?? null,
        city: m.city,
        type: typeFromName(u.name),
        ownership: m.ownership,
        website: m.website ?? null,
        verifiedAt: m.checked ? fetchedAt : null,
        sourceId: source.id,
      },
      update: {
        nacidId: u.nacidId,
        name: u.name,
        nameEn: u.nameEn,
        shortName: m.short ?? null,
        city: m.city,
        type: typeFromName(u.name),
        ownership: m.ownership,
        website: m.website ?? null,
        verifiedAt: m.checked ? fetchedAt : null,
        sourceId: source.id,
      },
    });
    uniIds.set(u.name, row.id);
  }

  // Факултети
  const facultyIds = new Map<string, string>();
  for (const p of data.programs) {
    if (!p.faculty || !uniIds.has(p.university)) continue;
    const key = `${p.university}|${p.faculty}`;
    if (facultyIds.has(key)) continue;
    const universityId = uniIds.get(p.university)!;
    const f = await db.faculty.upsert({
      where: { universityId_name: { universityId, name: p.faculty } },
      create: { universityId, name: p.faculty, verifiedAt: fetchedAt },
      update: { verifiedAt: fetchedAt },
    });
    facultyIds.set(key, f.id);
  }

  // Специалности (пакетно, с уникален slug)
  const existing = new Set((await db.program.findMany({ select: { slug: true } })).map((p) => p.slug));
  const usedSlugs = new Set<string>();
  const rows = [];
  for (const p of data.programs) {
    const universityId = uniIds.get(p.university);
    const d = DEGREE[p.degree];
    if (!universityId || !d || !p.name) continue;
    const uniSlug = metaByName.get(p.university)!.slug;
    let base = `${uniSlug}-${slugify(p.name).slice(0, 50)}-${d.degree.toLowerCase().replace("_", "-")}`;
    if (p.faculty) base += `-${slugify(p.faculty).split("-").slice(0, 2).join("-")}`;
    let slug = base;
    let i = 2;
    while (usedSlugs.has(slug)) slug = `${base}-${i++}`;
    usedSlugs.add(slug);
    rows.push({
      slug,
      universityId,
      facultyId: p.faculty ? (facultyIds.get(`${p.university}|${p.faculty}`) ?? null) : null,
      name: p.name,
      nameEn: p.nameEn,
      degree: d.degree,
      degreeDetail: d.detail ?? null,
      professionalField: p.field,
      durationYears: p.durations.length ? Math.max(...p.durations) : null,
      forms: p.forms,
      languages: p.languages,
      regulated: p.regulated,
      verifiedAt: fetchedAt,
      status: "VERIFIED" as const,
    });
  }
  // Премахваме специалности, които вече ги няма в регистъра (само ако не са свързани с потребители/програми)
  const newSlugs = new Set(rows.map((r) => r.slug));
  const stale = [...existing].filter((s) => !newSlugs.has(s));
  if (stale.length) await db.program.deleteMany({ where: { slug: { in: stale }, profiles: { none: {} }, curricula: { none: {} } } });
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const toCreate = chunk.filter((r) => !existing.has(r.slug));
    if (toCreate.length) await db.program.createMany({ data: toCreate, skipDuplicates: true });
    for (const r of chunk.filter((r) => existing.has(r.slug))) {
      await db.program.update({ where: { slug: r.slug }, data: r });
    }
  }
  log(`университети: ${uniIds.size}, факултети: ${facultyIds.size}, специалности: ${rows.length}`);
  return { universities: uniIds.size, faculties: facultyIds.size, programs: rows.length };
}

type Sppoo2024 = {
  list: string;
  source: { title: string; organization: string; url: string; page: string };
  fields: { code: string; name: string }[];
  directions: { code: string; name: string; field: string }[];
  professions: { code: string; name: string; direction: string; degrees: number[]; regulated: boolean }[];
};
type Sppoo2003 = {
  list: string;
  source: { title: string; organization: string; url: string; page: string };
  directions: { code: string; name: string; field: string }[];
  professions: { code: string; name: string; direction: string }[];
  specialties: { code: string; name: string; profession: string; degree: number | null; newProfession: string | null }[];
};

export async function importVocational(db: PrismaClient, root: string, log: (msg: string) => void = () => {}) {
  const v24 = JSON.parse(readFileSync(join(root, "vocational/sppoo-2024.json"), "utf8")) as Sppoo2024;
  const v03 = JSON.parse(readFileSync(join(root, "vocational/sppoo-2003.json"), "utf8")) as Sppoo2003;

  for (const src of [v24.source, v03.source]) {
    await db.source.upsert({
      where: { url: src.url },
      create: {
        title: src.title,
        organization: src.organization,
        url: src.url,
        type: "OFFICIAL_CURRICULUM",
        freshness: "CURRENT",
        verifiedAt: new Date("2026-10-11"),
        lastHttpStatus: 200,
        relatedTo: "Професионално образование",
      },
      update: { title: src.title, verifiedAt: new Date("2026-10-11"), freshness: "CURRENT" },
    });
  }

  const fieldNames = new Map(v24.fields.map((f) => [f.code, f.name]));
  const areaIds = new Map<string, string>();
  for (const d of v24.directions) {
    const row = await db.vocationalArea.upsert({
      where: { code: d.code },
      create: { code: d.code, name: d.name, fieldCode: d.field, fieldName: fieldNames.get(d.field) ?? null, listVersion: v24.list },
      update: { name: d.name, fieldCode: d.field, fieldName: fieldNames.get(d.field) ?? null, listVersion: v24.list },
    });
    areaIds.set(d.code, row.id);
  }
  for (const p of v24.professions) {
    const areaId = areaIds.get(p.direction);
    if (!areaId) continue;
    await db.vocationalProfession.upsert({
      where: { code: p.code },
      create: { code: p.code, name: p.name, areaId, qualificationLevels: p.degrees, regulated: p.regulated, listVersion: v24.list },
      update: { name: p.name, areaId, qualificationLevels: p.degrees, regulated: p.regulated, listVersion: v24.list },
    });
  }

  const area03 = new Map<string, string>();
  for (const d of v03.directions) {
    const row = await db.vocationalArea.upsert({
      where: { code: d.code },
      create: { code: d.code, name: d.name, fieldCode: d.field, listVersion: v03.list },
      update: { name: d.name, fieldCode: d.field, listVersion: v03.list },
    });
    area03.set(d.code, row.id);
  }
  const prof03 = new Map<string, string>();
  for (const p of v03.professions) {
    const areaId = area03.get(p.direction);
    if (!areaId) continue;
    const levels = [...new Set(v03.specialties.filter((s) => s.profession === p.code && s.degree).map((s) => s.degree!))].sort();
    const row = await db.vocationalProfession.upsert({
      where: { code: p.code },
      create: { code: p.code, name: p.name, areaId, qualificationLevels: levels, listVersion: v03.list },
      update: { name: p.name, areaId, qualificationLevels: levels, listVersion: v03.list },
    });
    prof03.set(p.code, row.id);
  }
  let specs = 0;
  for (const s of v03.specialties) {
    const professionId = prof03.get(s.profession);
    if (!professionId) continue;
    await db.vocationalSpecialty.upsert({
      where: { code: s.code },
      create: { code: s.code, name: s.name, professionId, qualificationLevel: s.degree, newProfessionCode: s.newProfession },
      update: { name: s.name, professionId, qualificationLevel: s.degree, newProfessionCode: s.newProfession },
    });
    specs++;
  }
  log(`СППОО-2024: ${v24.professions.length} професии; СППОО-2003: ${v03.professions.length} професии, ${specs} специалности`);
}

type DrivingCat = { code: string; name: string; description: string; minAge?: number };

export async function importDrivingCategories(db: PrismaClient, root: string) {
  const cats = parseYaml(readFileSync(join(root, "driving/categories.yaml"), "utf8")) as DrivingCat[];
  for (const [i, c] of cats.entries()) {
    await db.drivingCategory.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name, description: c.description, minAge: c.minAge ?? null, order: i },
      update: { name: c.name, description: c.description, minAge: c.minAge ?? null, order: i },
    });
  }
  return cats.length;
}
