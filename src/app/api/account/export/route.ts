import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

/** Преносимост на данните (чл. 20 GDPR): всички лични данни в JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Неоторизиран достъп." }, { status: 401 });
  const data = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      displayName: true,
      role: true,
      ageGroup: true,
      createdAt: true,
      emailVerifiedAt: true,
      profile: true,
      preferences: true,
      subjects: { select: { subject: { select: { name: true } } } },
      lessonProgress: { select: { lesson: { select: { title: true } }, status: true, timeSpentSec: true, bestQuizPercent: true, lastOpenedAt: true } },
      notes: { select: { title: true, body: true, createdAt: true, updatedAt: true } },
      bookmarks: { select: { lesson: { select: { title: true } }, createdAt: true } },
      flashcards: { select: { front: true, back: true, createdAt: true } },
      attempts: { select: { title: true, mode: true, percent: true, startedAt: true, submittedAt: true } },
      exams: { select: { title: true, date: true, notes: true } },
      studyPlans: { select: { title: true, examDate: true, items: { select: { title: true, dueDate: true, doneAt: true } } } },
      aiConversations: { select: { title: true, createdAt: true, messages: { select: { role: true, content: true, createdAt: true } } } },
    },
  });
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), user: data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bg-learn-moite-danni.json"`,
      "Cache-Control": "no-store",
    },
  });
}
