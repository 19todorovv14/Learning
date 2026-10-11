import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "За съдържанието и източниците" };

const FRESHNESS: Record<string, string> = {
  CURRENT: "Проверен",
  UNVERIFIED: "Непроверен автоматично",
  NEEDS_REVIEW: "Нужна е проверка",
  OUTDATED: "Остарял",
};

export default async function AboutContentPage() {
  const sources = await db.source.findMany({ orderBy: [{ type: "asc" }, { title: "asc" }] });
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">За съдържанието и източниците</h1>
      <div className="prose-lesson mt-6">
        <p>
          Целта ни е учебният материал да е <strong>точен, разбираем и честно обозначен</strong>. Затова всеки урок има статус:
        </p>
        <ul>
          <li><strong>Чака проверка</strong> — написан е с помощта на AI по учебните програми и още не е прегледан от преподавател.</li>
          <li><strong>Проверено</strong> — прегледан и одобрен от редактор.</li>
          <li><strong>Остаряло</strong> — правилата или програмата може да са се променили.</li>
        </ul>
        <p>
          Данните за висшите училища и специалностите са изтеглени от публичния регистър на НАЦИД, а за професиите — от
          официалния Списък на професиите за професионално образование и обучение (НАПОО/МОН). Не измисляме изпитни
          изисквания, учебни планове или преподаватели. Когато официална информация липсва, го казваме.
        </p>
        <p>Обясненията са оригинални — не копираме защитени учебници или платени материали.</p>
      </div>
      <h2 className="mt-10 text-xl font-semibold">Източници</h2>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Източник</th>
              <th className="px-4 py-2.5 font-medium">Организация</th>
              <th className="px-4 py-2.5 font-medium">Статус</th>
              <th className="px-4 py-2.5 font-medium">Проверен</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {s.title} <ExternalLink className="h-3 w-3" />
                  </a>
                  {s.verificationNote && <div className="mt-0.5 text-xs text-muted">{s.verificationNote}</div>}
                </td>
                <td className="px-4 py-2.5 text-text-2">{s.organization}</td>
                <td className="px-4 py-2.5">{FRESHNESS[s.freshness]}</td>
                <td className="px-4 py-2.5 text-muted">{s.verifiedAt ? formatDate(s.verifiedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
