import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { learnerStatuses } from "@/lib/data/visibility";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [lessons, courses, unis] = await Promise.all([
    db.lesson.findMany({ where: { status: { in: learnerStatuses() } }, select: { slug: true, updatedAt: true } }),
    db.curriculumVersion.findMany({ select: { slug: true, updatedAt: true } }),
    db.university.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...["/", "/subjects", "/lessons", "/admission", "/universities", "/vocational", "/driving", "/first-aid", "/about-content"].map((p) => ({ url: appUrl(p) })),
    ...courses.map((c) => ({ url: appUrl(`/courses/${c.slug}`), lastModified: c.updatedAt })),
    ...lessons.map((l) => ({ url: appUrl(`/lessons/${l.slug}`), lastModified: l.updatedAt })),
    ...unis.map((u) => ({ url: appUrl(`/universities/${u.slug}`), lastModified: u.updatedAt })),
  ];
}
