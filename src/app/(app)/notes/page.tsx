import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, History, NotebookPen } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Markdown } from "@/components/markdown/markdown";
import { EmptyState } from "@/components/ui/misc";
import { NoteEditor } from "@/components/notes/note-editor";
import { deleteNoteAction } from "@/app/actions/notes";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Моите записки" };

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const user = await requireUserPage("/notes");
  const sp = await searchParams;
  const tab = sp.tab === "bookmarks" || sp.tab === "recent" ? sp.tab : "notes";
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;
  const lessonSlug = typeof sp.lesson === "string" ? sp.lesson : undefined;

  const [notes, bookmarks, recent, editNote, lesson] = await Promise.all([
    db.userNote.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 200, include: { lesson: { select: { slug: true, title: true } } } }),
    db.bookmark.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { lesson: { select: { slug: true, title: true, subject: { select: { name: true } }, gradeId: true } } } }),
    db.lessonProgress.findMany({ where: { userId: user.id }, orderBy: { lastOpenedAt: "desc" }, take: 30, include: { lesson: { select: { slug: true, title: true, subject: { select: { name: true } } } } } }),
    editId ? db.userNote.findFirst({ where: { id: editId, userId: user.id } }) : null,
    lessonSlug ? db.lesson.findUnique({ where: { slug: lessonSlug }, select: { id: true, title: true } }) : null,
  ]);

  const tabs = [
    { id: "notes", label: `Записки (${notes.length})`, Icon: NotebookPen },
    { id: "bookmarks", label: `Любими (${bookmarks.length})`, Icon: Bookmark },
    { id: "recent", label: "Наскоро отворени", Icon: History },
  ];

  return (
    <>
      <PageHeader title="Моите записки" description="Твоите бележки, любими уроци и наскоро отворени теми — на едно място." />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border" aria-label="Раздели">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/notes${t.id === "notes" ? "" : `?tab=${t.id}`}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}
          >
            <t.Icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </nav>

      {tab === "notes" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3">
            {notes.length === 0 && <EmptyState title="Още нямаш записки">Пиши свои бележки — с формули ($…$), списъци и таблици.</EmptyState>}
            {notes.map((n) => (
              <article key={n.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{n.title}</h2>
                    <div className="text-xs text-muted">
                      {formatDate(n.updatedAt)}
                      {n.lesson && (
                        <>
                          {" · "}
                          <Link href={`/lessons/${n.lesson.slug}`} className="text-primary hover:underline">
                            {n.lesson.title}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/notes?edit=${n.id}`} className="btn-ghost px-2 py-1 text-xs">
                      Редактирай
                    </Link>
                    <form action={deleteNoteAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="btn-ghost px-2 py-1 text-xs text-danger" type="submit">
                        Изтрий
                      </button>
                    </form>
                  </div>
                </div>
                {n.body && <Markdown className="mt-3 max-w-none text-[15px]">{n.body}</Markdown>}
              </article>
            ))}
          </div>
          <aside>
            <div className="lg:sticky lg:top-24">
              <NoteEditor
                key={editNote?.id ?? lesson?.id ?? "new"}
                note={editNote ? { id: editNote.id, title: editNote.title, body: editNote.body, lessonId: editNote.lessonId } : null}
                lesson={lesson}
              />
            </div>
          </aside>
        </div>
      )}

      {tab === "bookmarks" &&
        (bookmarks.length === 0 ? (
          <EmptyState title="Няма любими уроци">Натисни „Добави в любими“ в урок, за да го запазиш тук.</EmptyState>
        ) : (
          <ul className="card divide-y divide-border">
            {bookmarks.map((b) => (
              <li key={b.lessonId}>
                <Link href={`/lessons/${b.lesson.slug}`} className="block px-5 py-3.5 hover:bg-surface-2">
                  <div className="font-medium">{b.lesson.title}</div>
                  <div className="text-xs text-muted">
                    {b.lesson.subject.name}
                    {b.lesson.gradeId ? ` · ${b.lesson.gradeId}. клас` : ""}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {tab === "recent" &&
        (recent.length === 0 ? (
          <EmptyState title="Още не си отварял уроци" />
        ) : (
          <ul className="card divide-y divide-border">
            {recent.map((r) => (
              <li key={r.lessonId}>
                <Link href={`/lessons/${r.lesson.slug}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-2">
                  <div>
                    <div className="font-medium">{r.lesson.title}</div>
                    <div className="text-xs text-muted">{r.lesson.subject.name}</div>
                  </div>
                  <span className="text-xs text-muted">{formatDate(r.lastOpenedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
