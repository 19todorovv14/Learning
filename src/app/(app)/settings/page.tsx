import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ChangePasswordForm, DeleteAccountForm, PreferencesForm, ProfileForm } from "@/components/settings/settings-forms";
import { logoutEverywhereAction } from "@/app/actions/settings";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Профил и настройки" };

const LEARNER: Record<string, string> = {
  SCHOOL: "Ученик",
  LANGUAGE_SCHOOL: "Езикова гимназия",
  VOCATIONAL: "Професионална гимназия",
  UNIVERSITY: "Студент",
  APPLICANT: "Кандидат-студент",
  DRIVING: "Шофьорски изпит",
  SELF: "Самостоятелно обучение",
  OTHER: "Друго",
};

export default async function SettingsPage() {
  const user = await requireUserPage("/settings");
  const [row, prefs, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: { include: { school: true, university: true, program: true, vocationalProfession: true, vocationalSpecialty: true } } },
    }),
    db.userPreferences.findUnique({ where: { userId: user.id } }),
    db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
  ]);
  const p = row.profile;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Профил и настройки" />

      <section className="card p-6">
        <h2 className="section-title">Профил</h2>
        <p className="mt-1 text-sm text-muted">
          {row.email} · член от {formatDate(row.createdAt)} · {row.emailVerifiedAt ? "имейлът е потвърден" : "имейлът не е потвърден"}
        </p>
        <ProfileForm displayName={row.displayName} />
      </section>

      <section className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Какво уча</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Вид</dt>
                <dd>{p ? LEARNER[p.learnerType] : "—"}</dd>
              </div>
              {p?.grade && (
                <div>
                  <dt className="text-muted">Клас</dt>
                  <dd>{p.grade}. клас</dd>
                </div>
              )}
              {(p?.school || p?.schoolNameCustom) && (
                <div>
                  <dt className="text-muted">Училище</dt>
                  <dd>{p.school?.name ?? p.schoolNameCustom}</dd>
                </div>
              )}
              {p?.university && (
                <div>
                  <dt className="text-muted">Висше училище</dt>
                  <dd>{p.university.name}</dd>
                </div>
              )}
              {(p?.program || p?.programNameCustom) && (
                <div>
                  <dt className="text-muted">Специалност</dt>
                  <dd>{p.program?.name ?? p.programNameCustom}</dd>
                </div>
              )}
              {(p?.vocationalSpecialty || p?.vocationalProfession) && (
                <div>
                  <dt className="text-muted">Професия</dt>
                  <dd>{p.vocationalSpecialty?.name ?? p.vocationalProfession?.name}</dd>
                </div>
              )}
              {p?.drivingCategoryCode && (
                <div>
                  <dt className="text-muted">Категория</dt>
                  <dd>{p.drivingCategoryCode}</dd>
                </div>
              )}
            </dl>
          </div>
          <Link href="/onboarding" className="btn-secondary shrink-0">
            Промени
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="section-title">Тема</h2>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="section-title">Цели и напомняния</h2>
        <PreferencesForm
          prefs={{
            emailReminders: prefs?.emailReminders ?? false,
            inAppReminders: prefs?.inAppReminders ?? true,
            dailyGoalMinutes: prefs?.dailyGoalMinutes ?? 20,
            weeklyGoalLessons: prefs?.weeklyGoalLessons ?? 5,
          }}
        />
      </section>

      <section className="card p-6">
        <h2 className="section-title">Сигурност</h2>
        <ChangePasswordForm />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-sm">
          <span className="text-muted">Активни сесии: {sessions}</span>
          <form action={logoutEverywhereAction}>
            <button className="btn-secondary">Изход от всички устройства</button>
          </form>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="section-title">Моите данни</h2>
        <p className="mt-1 text-sm text-muted">
          Изтегли всички данни, които пазим за теб, във формат JSON. Прочети{" "}
          <Link href="/privacy" className="text-primary underline">
            политиката за поверителност
          </Link>
          .
        </p>
        <a href="/api/account/export" className="btn-secondary mt-4">
          Изтегли моите данни
        </a>
      </section>

      <section className="card border-danger/30 p-6">
        <h2 className="section-title text-danger">Изтриване на профила</h2>
        <p className="mt-1 text-sm text-muted">
          Изтриват се завинаги профилът, прогресът, записките, тестовете и разговорите с AI учителя. Действието е необратимо.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
