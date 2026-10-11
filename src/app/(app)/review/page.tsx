import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { MATURE_INTERVAL_DAYS } from "@/lib/srs";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/misc";
import { ReviewSession } from "@/components/review/review-session";
import { NewCardForm } from "@/components/review/new-card-form";

export const metadata: Metadata = { title: "Преговор" };

export default async function ReviewPage() {
  const user = await requireUserPage("/review");
  const now = new Date();
  const [due, total, mature, upcoming] = await Promise.all([
    db.reviewState.findMany({
      where: { userId: user.id, dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
      take: 40,
      include: { flashcard: { include: { lesson: { select: { slug: true, title: true } } } } },
    }),
    db.reviewState.count({ where: { userId: user.id } }),
    db.reviewState.count({ where: { userId: user.id, intervalDays: { gte: MATURE_INTERVAL_DAYS } } }),
    db.reviewState.count({ where: { userId: user.id, dueAt: { gt: now, lte: new Date(now.getTime() + 7 * 86400000) } } }),
  ]);

  return (
    <>
      <PageHeader
        kicker="Интервално повторение"
        title="Преговор"
        description="Картите се появяват точно преди да започнеш да ги забравяш. Колкото по-добре знаеш една карта, толкова по-рядко я виждаш."
      />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="За днес" value={due.length} />
        <Stat label="Следващите 7 дни" value={upcoming} />
        <Stat label="Всички карти" value={total} />
        <Stat label="Усвоени" value={mature} hint={`интервал ≥ ${MATURE_INTERVAL_DAYS} дни`} />
      </div>

      {total === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-medium">Още нямаш карти за преговор</p>
          <p className="mt-1 text-sm text-muted">
            Отвори урок и натисни „Преговаряй определенията“ или създай своя карта по-долу.
          </p>
          <Link href="/lessons" className="btn-primary mt-4">
            Към уроците
          </Link>
        </div>
      ) : (
        <ReviewSession
          cards={due.map((r) => ({
            id: r.flashcardId,
            front: r.flashcard.front,
            back: r.flashcard.back,
            lesson: r.flashcard.lesson,
            own: r.flashcard.userId === user.id,
          }))}
        />
      )}

      <section className="mt-10">
        <h2 className="section-title mb-3">Нова карта</h2>
        <NewCardForm />
      </section>
    </>
  );
}
