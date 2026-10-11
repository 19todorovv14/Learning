import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { TutorChat } from "@/components/tutor/tutor-chat";
import { TutorLayout } from "./tutor-layout";

export const metadata: Metadata = { title: "AI учител" };

export default async function TutorPage({ searchParams }: PageProps<"/tutor">) {
  const user = await requireUserPage("/tutor");
  const sp = await searchParams;
  const topic = typeof sp.topic === "string" ? sp.topic.slice(0, 200) : undefined;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 1000) : undefined;
  const course = typeof sp.course === "string" ? await db.curriculumVersion.findUnique({ where: { slug: sp.course }, select: { title: true } }) : null;
  const topicLabel = topic && course ? `${topic} (${course.title})` : topic;

  return (
    <TutorLayout userId={user.id}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI учител</h1>
          <p className="mt-1 text-sm text-muted">
            Питай за всяка тема — от таблицата за умножение до висшата математика. Обяснявам според твоя клас и ниво.
          </p>
        </div>
        <Link href="/tutor/history" className="btn-ghost lg:hidden" aria-label="Разговори">
          <History className="h-4 w-4" />
        </Link>
      </div>
      <TutorChat
        topic={topicLabel}
        autoPrompt={q ?? (topicLabel ? `Обясни ми темата „${topicLabel}“ с прости думи.` : undefined)}
      />
    </TutorLayout>
  );
}
