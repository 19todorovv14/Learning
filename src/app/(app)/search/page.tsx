import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, GraduationCap, Hash, Landmark, Sparkles, Wrench } from "lucide-react";
import { globalSearch } from "@/lib/search/search";
import { SearchBox } from "@/components/layout/search-box";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { Markdown } from "@/components/markdown/markdown";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Търсене" };

const DEGREE: Record<string, string> = { PROFESSIONAL_BACHELOR: "Проф. бакалавър", BACHELOR: "Бакалавър", MASTER: "Магистър", DOCTOR: "Доктор" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const res = q ? await globalSearch(q) : null;
  const total = res
    ? res.lessons.length + res.terms.length + res.topics.length + res.universities.length + res.programs.length + res.professions.length
    : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Търсене</h1>
      <SearchBox defaultValue={q} autoFocus={!q} />
      {!q && (
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {["Обясни ми фотосинтезата за 7. клас", "формули за съкратено умножение", "Възраждане", "медицина", "двигатели с вътрешно горене", "предимство на кръстовище"].map((s) => (
            <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">
              {s}
            </Link>
          ))}
        </div>
      )}

      {res && (
        <div className="mt-6 space-y-8">
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-text-2">
              {res.parsed.grade && <span className="badge mr-2 bg-primary-soft text-primary">{res.parsed.grade}. клас</span>}
              {res.parsed.intent === "explain" && "Търсиш обяснение. "}
              {res.parsed.intent === "quiz" && "Искаш да те изпитаме. "}
              {res.parsed.intent === "admission" && "Търсиш информация за прием. "}
              {total ? `Намерени резултати: ${total}.` : "Не намерихме готов урок."}
              {res.relaxed && total > 0 && " (разширихме търсенето извън избрания предмет/клас)"}
            </div>
            <Link href={`/tutor?q=${encodeURIComponent(q)}`} className="btn-secondary shrink-0">
              <Sparkles className="h-4 w-4 text-accent" /> Питай AI учителя
            </Link>
          </div>

          {res.parsed.intent === "admission" && (
            <Link href="/admission" className="card block p-4 hover:shadow-pop">
              <div className="font-medium">Кандидатстване във висше училище →</div>
              <div className="text-sm text-muted">Специалности от регистъра на НАЦИД и линкове към официалните страници за прием.</div>
            </Link>
          )}

          {res.lessons.length > 0 && (
            <section>
              <h2 className="section-title mb-3 flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5" /> Уроци
              </h2>
              <ul className="space-y-2">
                {res.lessons.map((l) => (
                  <li key={l.id}>
                    <Link href={`/lessons/${l.slug}`} className="card group flex gap-3 p-4 hover:shadow-pop">
                      <SubjectIcon icon={l.icon} color={l.color} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium group-hover:text-primary">{l.title}</div>
                        <div className="text-xs text-muted">
                          {l.subject}
                          {l.gradeId ? ` · ${l.gradeId}. клас` : ""}
                        </div>
                        {l.summary && <p className="mt-1 line-clamp-2 text-sm text-text-2">{l.summary}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {res.terms.length > 0 && (
            <section>
              <h2 className="section-title mb-3 flex items-center gap-2">
                <Hash className="h-4.5 w-4.5" /> Определения
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {res.terms.map((t) => (
                  <Link key={t.id} href={`/lessons/${t.lesson.slug}?mode=learn`} className="card p-4 hover:shadow-pop">
                    <Markdown className="max-w-none text-[15px] font-semibold text-primary [&_p]:m-0">{t.term}</Markdown>
                    <Markdown className="mt-1 line-clamp-3 max-w-none text-sm">{t.definition}</Markdown>
                    <div className="mt-2 text-xs text-muted">от урока „{t.lesson.title}“</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {res.topics.length > 0 && (
            <section>
              <h2 className="section-title mb-3 flex items-center gap-2">
                <GraduationCap className="h-4.5 w-4.5" /> Теми от учебните програми
              </h2>
              <ul className="card divide-y divide-border">
                {res.topics.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted">{t.section.curriculumVersion.title}</div>
                    </div>
                    {t.lessons[0] ? (
                      <Link href={`/lessons/${t.lessons[0].lesson.slug}`} className="chip text-xs">
                        Към урока
                      </Link>
                    ) : (
                      <Link
                        href={`/tutor?topic=${encodeURIComponent(t.title)}&course=${t.section.curriculumVersion.slug}`}
                        className="chip text-xs"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-accent" /> Обясни с AI
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(res.universities.length > 0 || res.programs.length > 0) && (
            <section>
              <h2 className="section-title mb-3 flex items-center gap-2">
                <Landmark className="h-4.5 w-4.5" /> Висши училища и специалности
              </h2>
              <ul className="card divide-y divide-border">
                {res.universities.map((u) => (
                  <li key={u.slug}>
                    <Link href={`/universities/${u.slug}`} className="block px-4 py-3 hover:bg-surface-2">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted">{u.city}</div>
                    </Link>
                  </li>
                ))}
                {res.programs.map((p) => (
                  <li key={p.id}>
                    <Link href={`/universities/${p.university.slug}?q=${encodeURIComponent(p.name)}`} className="block px-4 py-3 hover:bg-surface-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted">
                        {DEGREE[p.degree]} · {p.university.shortName ?? p.university.name}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {res.professions.length > 0 && (
            <section>
              <h2 className="section-title mb-3 flex items-center gap-2">
                <Wrench className="h-4.5 w-4.5" /> Професии
              </h2>
              <ul className="card divide-y divide-border">
                {res.professions.map((p) => (
                  <li key={p.code}>
                    <Link href={`/vocational/${p.code}`} className="block px-4 py-3 hover:bg-surface-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted">
                        код {p.code} · {p.listVersion}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {total === 0 && (
            <EmptyState
              title="Нямаме готов урок за това — все още"
              action={
                <Link href={`/tutor?q=${encodeURIComponent(q)}`} className="btn-primary">
                  <Sparkles className="h-4 w-4" /> Обясни ми с AI
                </Link>
              }
            >
              AI учителят може да ти обясни темата веднага, съобразено с твоя клас.
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
