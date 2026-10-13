import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { computeCoverage, COVERAGE_LABEL, curriculumLabel, type CoverageStatus } from "@/lib/coverage";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Покритие · Админ" };

const CLS: Record<CoverageStatus, string> = {
  CONFIRMED: "bg-success-soft text-success",
  IMPORTED: "bg-warning-soft text-warning",
  PARTIAL: "bg-warning-soft text-warning",
  MISSING: "bg-danger-soft text-danger",
};

function Badge({ s }: { s: CoverageStatus }) {
  return <span className={`badge whitespace-nowrap ${CLS[s]}`}>{COVERAGE_LABEL[s]}</span>;
}

function Table({ rows }: { rows: { name: string; status: CoverageStatus; note: string; value?: string }[] }) {
  return (
    <div className="card divide-y divide-border">
      {rows.map((r) => (
        <div key={r.name} className="grid gap-1 p-3 text-sm md:grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)] md:gap-4">
          <div className="font-medium">{r.name}</div>
          <div>
            <Badge s={r.status} />
          </div>
          <div className="min-w-0 break-words text-text-2">
            {r.value && <div>{r.value}</div>}
            <div className="text-xs text-muted">{r.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function CoveragePage() {
  await requireRolePage("EDITOR", "/admin/coverage");
  const c = await computeCoverage(db);
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Покритие на българското образование</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">
        Изчислено от базата ({formatDateTime(c.generatedAt)}). „Очакваните“ предмети, профили и изпити са съставени ръчно по Наредба № 4/2015 —
        официалният текст на mon.bg не позволява автоматично изтегляне, затова са отбелязани за сверка. Същият отчет: <code>npm run coverage:report</code> →{" "}
        <code>docs/COVERAGE.md</code>.
      </p>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-2xl font-semibold">{c.lessons.verified}</div>
          <div className="text-xs text-muted">проверени урока от {c.lessons.total}</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-semibold">
            {c.schoolTopics.covered}/{c.schoolTopics.total}
          </div>
          <div className="text-xs text-muted">училищни теми с урок</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-semibold">
            {c.officialStructures}/{c.curriculaTotal}
          </div>
          <div className="text-xs text-muted">програми, сверени с официалната</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-semibold">{c.monSource?.freshness === "CURRENT" ? "да" : "не"}</div>
          <div className="text-xs text-muted">достъпни учебни програми на МОН</div>
        </div>
      </section>

      <h2 className="section-title mb-2">Институции и регистри</h2>
      <div className="mb-8">
        <Table rows={c.institutions} />
      </div>

      <h2 className="section-title mb-2">Училищно образование по класове</h2>
      <div className="card mb-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-2">
            <tr>
              <th className="px-3 py-2 font-medium">Клас</th>
              <th className="px-3 py-2 font-medium">Програми в базата</th>
              <th className="px-3 py-2 font-medium">Теми с урок</th>
              <th className="px-3 py-2 font-medium">Проверени уроци</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {c.grades.map((g) => (
              <tr key={g.grade}>
                <td className="px-3 py-2">{g.grade}.</td>
                <td className="px-3 py-2 text-text-2">{g.curricula.map(curriculumLabel).join(", ") || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {g.coveredTopics} / {g.topics}
                </td>
                <td className="px-3 py-2">{g.verifiedLessons}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.stages.map((st) => (
        <section key={st.stage} className="mb-6">
          <h2 className="section-title mb-2">Очаквани предмети: {st.stage} <span className="text-xs font-normal text-warning">(чака сверка)</span></h2>
          <Table rows={st.subjects} />
        </section>
      ))}

      <h2 className="section-title mb-2">
        Профилирана подготовка (XI–XII) <span className="text-xs font-normal text-warning">(чака сверка)</span>
      </h2>
      <div className="mb-8">
        <Table rows={c.profiles} />
      </div>

      <h2 className="section-title mb-2">
        НВО и ДЗИ <span className="text-xs font-normal text-warning">(чака сверка)</span>
      </h2>
      <Table rows={c.exams} />
    </>
  );
}
