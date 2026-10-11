import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { TutorChat } from "@/components/tutor/tutor-chat";
import { TutorLayout } from "../tutor-layout";
import { deleteConversationAction } from "@/app/actions/tutor";

export const metadata: Metadata = { title: "Разговор с AI учителя" };

export default async function ConversationPage({ params }: PageProps<"/tutor/[conversationId]">) {
  const { conversationId } = await params;
  const user = await requireUserPage(`/tutor/${conversationId}`);
  const conv = await db.aIConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      lesson: { select: { id: true, slug: true, title: true } },
    },
  });
  if (!conv || conv.userId !== user.id) notFound();

  return (
    <TutorLayout userId={user.id} activeId={conv.id}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="line-clamp-2 text-xl font-semibold tracking-tight">{conv.title}</h1>
          {conv.lesson && (
            <Link href={`/lessons/${conv.lesson.slug}`} className="text-sm text-primary hover:underline">
              Урок: {conv.lesson.title}
            </Link>
          )}
        </div>
        <form action={deleteConversationAction}>
          <input type="hidden" name="id" value={conv.id} />
          <button className="btn-ghost text-sm text-danger" type="submit">
            Изтрий разговора
          </button>
        </form>
      </div>
      <TutorChat
        conversationId={conv.id}
        lessonId={conv.lesson?.id}
        topic={conv.lesson?.title}
        initialMessages={conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, hadImage: m.hadImage }))}
      />
    </TutorLayout>
  );
}
