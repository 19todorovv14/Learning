import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Карта на покритието на българското образование — изчислява се от реалните данни в базата.
 * Статуси:
 *  - CONFIRMED: внесено от официален източник (регистър/нормативен документ) с дата на извличане;
 *  - IMPORTED: има структура/данни, но не са сверени с официалния документ (или съдържанието чака редактор);
 *  - PARTIAL: има част от данните;
 *  - MISSING: липсва.
 * „Очакваните“ предмети, профили и изпити са по Наредба № 4/2015 за учебния план и наредбите за изпитите —
 * написани ръчно, защото официалният текст (mon.bg) не позволява автоматично изтегляне. Затова са отбелязани „чака сверка“.
 */

export type CoverageStatus = "CONFIRMED" | "IMPORTED" | "PARTIAL" | "MISSING";
export const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  CONFIRMED: "Потвърдено (официален източник)",
  IMPORTED: "Внесено — чака сверка/проверка",
  PARTIAL: "Частично",
  MISSING: "Липсва",
};

type Expected = { name: string; slugs: string[]; language?: boolean };
const BEL: Expected = { name: "Български език и литература", slugs: ["bulgarski-ezik", "literatura"] };
const MATH: Expected = { name: "Математика", slugs: ["matematika"] };
const FL: Expected = { name: "Чужд език", slugs: [], language: true };
const MUS: Expected = { name: "Музика", slugs: ["muzika"] };
const ART: Expected = { name: "Изобразително изкуство", slugs: ["izobrazitelno-izkustvo"] };
const TECH: Expected = { name: "Технологии и предприемачество", slugs: ["tehnologii-i-predpriemachestvo"] };
const PE: Expected = { name: "Физическо възпитание и спорт", slugs: ["fizichesko-vazpitanie"] };
const HIST: Expected = { name: "История и цивилизации", slugs: ["istoriya"] };
const GEO: Expected = { name: "География и икономика", slugs: ["geografiya"] };

/** Очаквани предмети от общообразователната подготовка по етапи — ЧАКА СВЕРКА с Наредба № 4/2015 (с измененията). */
export const EXPECTED_STAGES: { stage: string; grades: number[]; subjects: Expected[] }[] = [
  {
    stage: "I–IV клас",
    grades: [1, 2, 3, 4],
    subjects: [
      BEL,
      MATH,
      FL,
      { name: "Околен свят (I–II)", slugs: ["okolen-svyat"] },
      { name: "Човекът и обществото (III–IV)", slugs: ["chovekat-i-obshtestvoto"] },
      { name: "Човекът и природата (III–IV)", slugs: ["chovekat-i-prirodata"] },
      { name: "Компютърно моделиране (III–IV)", slugs: [] },
      MUS,
      ART,
      TECH,
      PE,
    ],
  },
  {
    stage: "V–VII клас",
    grades: [5, 6, 7],
    subjects: [
      BEL,
      MATH,
      FL,
      { name: "Компютърно моделиране и информационни технологии", slugs: ["informatsionni-tehnologii"] },
      HIST,
      GEO,
      { name: "Човекът и природата (V–VI)", slugs: ["chovekat-i-prirodata"] },
      { name: "Биология и здравно образование (VII)", slugs: ["biologiya"] },
      { name: "Физика и астрономия (VII)", slugs: ["fizika"] },
      { name: "Химия и опазване на околната среда (VII)", slugs: ["himiya"] },
      MUS,
      ART,
      TECH,
      PE,
    ],
  },
  {
    stage: "VIII–X клас",
    grades: [8, 9, 10],
    subjects: [
      BEL,
      MATH,
      FL,
      { name: "Информатика", slugs: ["informatika"] },
      { name: "Информационни технологии", slugs: ["informatsionni-tehnologii"] },
      HIST,
      GEO,
      { name: "Философия", slugs: ["filosofiya"] },
      { name: "Биология и здравно образование", slugs: ["biologiya"] },
      { name: "Физика и астрономия", slugs: ["fizika"] },
      { name: "Химия и опазване на околната среда", slugs: ["himiya"] },
      { name: "Предприемачество (X)", slugs: [] },
      MUS,
      ART,
      PE,
    ],
  },
  {
    stage: "XI–XII клас (общообразователна подготовка)",
    grades: [11, 12],
    subjects: [BEL, MATH, FL, { name: "Гражданско образование", slugs: ["grazhdansko-obrazovanie"] }, PE],
  },
];

/** Профили в профилираната подготовка — ЧАКА СВЕРКА. `slugs` — профилиращи предмети, които вече имат програма за XI–XII. */
export const EXPECTED_PROFILES: { name: string; slugs: string[] }[] = [
  { name: "Чуждоезиков", slugs: [] },
  { name: "Хуманитарен", slugs: [] },
  { name: "Обществени науки", slugs: [] },
  { name: "Икономическо развитие", slugs: [] },
  { name: "Софтуерни и хардуерни науки", slugs: [] },
  { name: "Предприемачески", slugs: [] },
  { name: "Природни науки", slugs: [] },
  { name: "Математически", slugs: ["matematika"] },
  { name: "Изобразително изкуство", slugs: [] },
  { name: "Музика", slugs: [] },
  { name: "Физическо възпитание и спорт", slugs: [] },
];

/** Национални външни оценявания и ДЗИ — задължителните части; ЧАКА СВЕРКА с наредбата за оценяването. */
export const EXPECTED_EXAMS: { name: string; curricula: string[] }[] = [
  { name: "НВО IV клас — български език и литература", curricula: [] },
  { name: "НВО IV клас — математика", curricula: [] },
  { name: "НВО VII клас — български език и литература", curricula: ["bel-nvo-7"] },
  { name: "НВО VII клас — математика", curricula: ["matematika-nvo-7"] },
  { name: "НВО X клас — български език и литература", curricula: [] },
  { name: "НВО X клас — математика", curricula: [] },
  { name: "ДЗИ — български език и литература (задължителен)", curricula: ["literatura-dzi"] },
  { name: "ДЗИ — втори зрелостен изпит (по избор, напр. математика)", curricula: ["matematika-dzi"] },
];

type CvRow = {
  slug: string;
  title: string;
  track: string;
  gradeId: number | null;
  gradeTo: number | null;
  variant: string | null;
  isOfficialStructure: boolean;
  subjectSlug: string;
  subjectName: string;
  subjectCategory: string;
  topics: number;
  coveredTopics: number;
  /** теми с урок, който има обяснение, записки, упражнения или въпроси от учителя и ≥ 3 тестови въпроса */
  completeTopics: number;
  topicsWithExercises: number;
  topicsWithTests: number;
  approvedTopics: number;
  lessons: number;
  verifiedLessons: number;
};

/**
 * Кога темата е „пълна“: има урок (не чернова) с обяснение и записки поне MIN_BODY знака,
 * упражнения или въпроси от учителя и поне 3 тестови въпроса. Самата тема или заглавие не се броят.
 */
export const MIN_BODY_CHARS = 3000;

export type CurriculumCoverage = CvRow & { status: CoverageStatus };

function cvStatus(c: CvRow): CoverageStatus {
  if (c.verifiedLessons > 0 && c.isOfficialStructure && c.coveredTopics === c.topics) return "CONFIRMED";
  if (c.coveredTopics === 0) return "IMPORTED";
  return "PARTIAL";
}

export type Metrics = {
  topics: number;
  coveredTopics: number;
  completeTopics: number;
  topicsWithExercises: number;
  topicsWithTests: number;
  approvedTopics: number;
  verifiedLessons: number;
};

export function sumMetrics(list: Metrics[]): Metrics {
  const sum = (k: keyof Metrics) => list.reduce((a, c) => a + c[k], 0);
  return {
    topics: sum("topics"),
    coveredTopics: sum("coveredTopics"),
    completeTopics: sum("completeTopics"),
    topicsWithExercises: sum("topicsWithExercises"),
    topicsWithTests: sum("topicsWithTests"),
    approvedTopics: sum("approvedTopics"),
    verifiedLessons: sum("verifiedLessons"),
  };
}

export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

export const TRACK_LABEL: Record<string, string> = {
  SCHOOL: "Училище (1.–12. клас)",
  ADMISSION: "Изпити: НВО, ДЗИ, кандидатстване",
  LANGUAGE: "Чужди езици (по нива)",
  VOCATIONAL: "Професионално образование",
  UNIVERSITY: "Университетски курсове",
  DRIVING: "Шофьорски изпит",
  FIRST_AID: "Първа помощ и спасители",
  OTHER: "Други",
};

export async function computeCoverage(db: PrismaClient) {
  const cvRows = await db.$queryRaw<CvRow[]>`
    WITH lesson_stats AS (
      SELECT l.id, l.status,
        (SELECT coalesce(sum(length(ls.body)), 0) FROM "LessonSection" ls WHERE ls."lessonId" = l.id) AS body,
        (SELECT count(*) FROM "Exercise" e WHERE e."lessonId" = l.id) AS exercises,
        (SELECT count(*) FROM "LessonQA" q WHERE q."lessonId" = l.id) AS qa,
        (SELECT count(*) FROM "Question" q WHERE q."lessonId" = l.id AND q.origin <> 'AI_GENERATED') AS questions
      FROM "Lesson" l WHERE l.status <> 'DRAFT'
    ),
    topic_stats AS (
      SELECT t.id AS "topicId", cs."curriculumVersionId" AS cv,
        bool_or(ls.id IS NOT NULL) AS has_lesson,
        bool_or(ls.body >= ${MIN_BODY_CHARS} AND (ls.exercises > 0 OR ls.qa > 0) AND ls.questions >= 3) AS complete,
        bool_or(ls.exercises > 0) AS has_ex,
        bool_or(ls.questions >= 3) AS has_test,
        bool_or(ls.status IN ('VERIFIED','PUBLISHED')) AS approved
      FROM "CurriculumTopic" t
      JOIN "CurriculumSection" cs ON cs.id = t."sectionId"
      LEFT JOIN "TopicLesson" tl ON tl."topicId" = t.id
      LEFT JOIN lesson_stats ls ON ls.id = tl."lessonId"
      GROUP BY t.id, cs."curriculumVersionId"
    )
    SELECT cv.slug, cv.title, cv.track::text AS track, cv."gradeId", cv."gradeTo", cv.variant, cv."isOfficialStructure",
      s.slug AS "subjectSlug", s.name AS "subjectName", s.category::text AS "subjectCategory",
      (SELECT count(*)::int FROM topic_stats ts WHERE ts.cv = cv.id) AS topics,
      (SELECT count(*)::int FROM topic_stats ts WHERE ts.cv = cv.id AND ts.has_lesson) AS "coveredTopics",
      (SELECT count(*)::int FROM topic_stats ts WHERE ts.cv = cv.id AND ts.complete) AS "completeTopics",
      (SELECT count(*)::int FROM topic_stats ts WHERE ts.cv = cv.id AND ts.has_ex) AS "topicsWithExercises",
      (SELECT count(*)::int FROM topic_stats ts WHERE ts.cv = cv.id AND ts.has_test) AS "topicsWithTests",
      (SELECT count(*)::int FROM topic_stats ts WHERE ts.cv = cv.id AND ts.approved) AS "approvedTopics",
      (SELECT count(*)::int FROM "Lesson" l WHERE l."curriculumVersionId" = cv.id) AS lessons,
      (SELECT count(*)::int FROM "Lesson" l WHERE l."curriculumVersionId" = cv.id AND l.status IN ('VERIFIED','PUBLISHED')) AS "verifiedLessons"
    FROM "CurriculumVersion" cv JOIN "Subject" s ON s.id = cv."subjectId"
    ORDER BY cv.track, cv."gradeId" NULLS LAST, s."order"`;
  const curricula: CurriculumCoverage[] = cvRows.map((c) => ({ ...c, status: cvStatus(c) }));
  const covers = (c: CvRow, g: number) => c.gradeId === g || (c.gradeId !== null && c.gradeTo !== null && c.gradeId <= g && c.gradeTo >= g);
  const school = curricula.filter((c) => c.track === "SCHOOL");
  const languageCurricula = curricula.filter((c) => c.track === "LANGUAGE");

  const grades = Array.from({ length: 12 }, (_, i) => i + 1).map((g) => {
    const list = school.filter((c) => covers(c, g));
    return { grade: g, curricula: list, ...sumMetrics(list) };
  });

  const stages = EXPECTED_STAGES.map((st) => ({
    stage: st.stage,
    subjects: st.subjects.map((e) => {
      const found = e.language ? languageCurricula : school.filter((c) => e.slugs.includes(c.subjectSlug) && st.grades.some((g) => covers(c, g)));
      const gradesWith = e.language ? [] : st.grades.filter((g) => found.some((c) => covers(c, g)));
      const status: CoverageStatus = !found.length
        ? "MISSING"
        : e.language
          ? "PARTIAL"
          : gradesWith.length < st.grades.length && !/\(/.test(e.name)
            ? "PARTIAL"
            : found.some((c) => c.coveredTopics > 0)
              ? "PARTIAL"
              : "IMPORTED";
      return {
        name: e.name,
        status,
        note: e.language
          ? `курсове по нива (CEFR), не по класове: ${found.length} програми`
          : found.length
            ? `програми: ${found.map((c) => c.slug).join(", ")}; класове с програма: ${gradesWith.join(", ") || "—"}; теми с урок: ${found.reduce((a, c) => a + c.coveredTopics, 0)}/${found.reduce((a, c) => a + c.topics, 0)}`
            : "няма програма в базата",
      };
    }),
  }));

  const profiles = EXPECTED_PROFILES.map((p) => {
    const found = school.filter((c) => p.slugs.includes(c.subjectSlug) && (c.variant ?? "").includes("ПП") && (c.gradeId ?? 0) >= 11);
    return {
      name: p.name,
      status: (found.length ? "PARTIAL" : "MISSING") as CoverageStatus,
      note: found.length ? `има само: ${found.map((c) => c.slug).join(", ")} (останалите профилиращи предмети и модули липсват)` : "няма програми за профилиращите предмети",
    };
  });

  const exams = EXPECTED_EXAMS.map((e) => {
    const found = curricula.filter((c) => e.curricula.includes(c.slug));
    return {
      name: e.name,
      status: (found.length ? (found.some((c) => c.coveredTopics > 0) ? "PARTIAL" : "IMPORTED") : "MISSING") as CoverageStatus,
      note: found.length
        ? `${found.map((c) => `${c.slug}: ${c.coveredTopics}/${c.topics} теми с урок`).join("; ")}; официалната изпитна програма (mon.bg) не е сверена`
        : "няма подготвителен курс",
    };
  });

  const [
    schoolsTotal,
    schoolsVerified,
    universities,
    universitiesSiteChecked,
    programs,
    programsByDegree,
    universitiesWithoutPrograms,
    admissions,
    admissionsCurrent,
    professions,
    specialties,
    lessonsByStatus,
    sources,
  ] = await Promise.all([
    db.school.count(),
    db.school.count({ where: { verified: true } }),
    db.university.count(),
    db.university.count({ where: { verifiedAt: { not: null } } }),
    db.program.count(),
    db.program.groupBy({ by: ["degree"], _count: true }),
    db.university.count({ where: { programs: { none: {} } } }),
    db.admissionInfo.count(),
    db.admissionInfo.count({ where: { verificationStatus: "CURRENT" } }),
    db.vocationalProfession.count(),
    db.vocationalSpecialty.count(),
    db.lesson.groupBy({ by: ["status"], _count: true }),
    db.source.findMany({ where: { key: { in: ["nacid-rvu", "navet-sppoo", "mon"] } }, select: { key: true, verifiedAt: true, freshness: true } }),
  ]);
  const src = (k: string) => sources.find((s) => s.key === k);
  const vocationalCurricula = curricula.filter((c) => c.track === "VOCATIONAL");
  const universityCurricula = curricula.filter((c) => c.track === "UNIVERSITY");
  const admissionCurricula = curricula.filter((c) => c.track === "ADMISSION" && c.gradeId === null);
  const lessonCount = (s: string[]) => lessonsByStatus.filter((l) => s.includes(l.status)).reduce((a, l) => a + l._count, 0);

  const institutions = [
    {
      name: "Училища (регистър на институциите, МОН)",
      status: (schoolsVerified > 0 ? "PARTIAL" : "MISSING") as CoverageStatus,
      value: `${schoolsVerified} потвърдени · ${schoolsTotal - schoolsVerified} въведени от потребители (непотвърдени)`,
      note: "ri.mon.bg отказва автоматичен достъп (403) — нужен е CSV, изтеглен ръчно от регистъра, и импорт (Админ → Импорт).",
    },
    {
      name: "Висши училища (регистър на НАЦИД)",
      status: (universities ? "CONFIRMED" : "MISSING") as CoverageStatus,
      value: `${universities} висши училища · сайтът отговори при проверка: ${universitiesSiteChecked}`,
      note: `снимка на публичния регистър от ${src("nacid-rvu")?.verifiedAt?.toISOString().slice(0, 10) ?? "—"}; ${universitiesWithoutPrograms} без специалности в снимката`,
    },
    {
      name: "Специалности във висшите училища (НАЦИД)",
      status: (programs ? "CONFIRMED" : "MISSING") as CoverageStatus,
      value: `${programs} · ${programsByDegree.map((d) => `${d.degree}: ${d._count}`).join(", ")}`,
      note: "от същата снимка на регистъра; учебните планове на специалностите не са внесени",
    },
    {
      name: "Кандидатстудентски изпити и условия за прием",
      status: (admissionsCurrent ? "PARTIAL" : "MISSING") as CoverageStatus,
      value: `${admissions} записа (${admissionsCurrent} проверени)`,
      note: "всяко висше училище публикува условията отделно, без общ официален API; подготвителни курсове (неофициални): " +
        (admissionCurricula.map((c) => c.slug).join(", ") || "няма"),
    },
    {
      name: "Професии и специалности за професионално образование (СППОО, НАПОО)",
      status: (professions ? "CONFIRMED" : "MISSING") as CoverageStatus,
      value: `${professions} професии · ${specialties} специалности`,
      note: `от официалния списък на НАПОО (${src("navet-sppoo")?.verifiedAt?.toISOString().slice(0, 10) ?? "—"}); учебни курсове по професионална подготовка: ${vocationalCurricula.length}, теми с урок ${vocationalCurricula.reduce((a, c) => a + c.coveredTopics, 0)}/${vocationalCurricula.reduce((a, c) => a + c.topics, 0)}`,
    },
    {
      name: "Университетски учебни курсове",
      status: (universityCurricula.some((c) => c.coveredTopics) ? "PARTIAL" : universityCurricula.length ? "IMPORTED" : "MISSING") as CoverageStatus,
      value: `${universityCurricula.length} курса · теми с урок ${universityCurricula.reduce((a, c) => a + c.coveredTopics, 0)}/${universityCurricula.reduce((a, c) => a + c.topics, 0)}`,
      note: "обща подготовка по направления, не официални програми на конкретни университети",
    },
  ];

  const tracks = Object.keys(TRACK_LABEL)
    .map((track) => {
      const list = curricula.filter((c) => c.track === track);
      return { track, label: TRACK_LABEL[track], curricula: list, ...sumMetrics(list) };
    })
    .filter((t) => t.curricula.length > 0);

  return {
    generatedAt: new Date(),
    tracks,
    monSource: src("mon"),
    grades,
    stages,
    profiles,
    exams,
    institutions,
    lessons: {
      total: lessonCount(["DRAFT", "AI_GENERATED", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "OUTDATED"]),
      verified: lessonCount(["VERIFIED", "PUBLISHED"]),
      pending: lessonCount(["PENDING_REVIEW", "AI_GENERATED"]),
      draft: lessonCount(["DRAFT"]),
    },
    schoolTopics: {
      total: school.reduce((a, c) => a + c.topics, 0),
      covered: school.reduce((a, c) => a + c.coveredTopics, 0),
      complete: school.reduce((a, c) => a + c.completeTopics, 0),
    },
    officialStructures: curricula.filter((c) => c.isOfficialStructure).length,
    curriculaTotal: curricula.length,
  };
}

export type Coverage = Awaited<ReturnType<typeof computeCoverage>>;

/** „Математика (ПП)“ — видът подготовка, когато не е общообразователна. */
export function curriculumLabel(c: { subjectName: string; variant: string | null }) {
  return c.variant && c.variant !== "ООП" ? `${c.subjectName} (${c.variant})` : c.subjectName;
}

const ICON: Record<CoverageStatus, string> = { CONFIRMED: "✅", IMPORTED: "🟡", PARTIAL: "🟠", MISSING: "❌" };

/** Markdown версия за docs/COVERAGE.md. */
export function coverageMarkdown(c: Coverage) {
  const L: string[] = [];
  L.push(`# Покритие на българското образование в BG LEARN`, "");
  L.push(`Генерирано от базата на ${c.generatedAt.toISOString().slice(0, 10)} с \`npm run coverage:report\`. Нищо тук не е оценка „на око“ — числата са от базата.`, "");
  L.push("Легенда: ✅ потвърдено от официален източник · 🟡 внесено, чака сверка/проверка · 🟠 частично · ❌ липсва", "");
  L.push("## Обобщение", "");
  L.push(`- Уроци: **${c.lessons.total}**, от тях **проверени от редактор: ${c.lessons.verified}**, чакат проверка: ${c.lessons.pending}, чернови: ${c.lessons.draft}.`);
  L.push(`- Училищни теми с урок: **${c.schoolTopics.covered} от ${c.schoolTopics.total}**, от тях пълни (урок + упражнения + тест): **${c.schoolTopics.complete}**.`);
  L.push(
    `- Учебни програми (структури): ${c.curriculaTotal}; сверени с официалната програма: **${c.officialStructures}**. Източникът „МОН — учебни програми“ е ${
      c.monSource?.freshness === "CURRENT" ? "проверен" : "НЕПРОВЕРЕН (mon.bg отказва автоматичен достъп)"
    }.`,
    "",
  );
  L.push("## Институции и регистри", "", "| Област | Статус | Данни | Бележка |", "|---|---|---|---|");
  for (const i of c.institutions) L.push(`| ${i.name} | ${ICON[i.status]} ${COVERAGE_LABEL[i.status]} | ${i.value} | ${i.note} |`);
  L.push(
    "",
    "## Училищно образование по класове (от базата)",
    "",
    `„Пълна“ тема = урок (не чернова) с обяснение и записки ≥ ${MIN_BODY_CHARS} знака, упражнения или въпроси от учителя и ≥ 3 тестови въпроса.`,
    "",
    "| Клас | Програми | Теми | С урок | Пълни | % пълни | С упражнения | С тест | Одобрени |",
    "|---|---|---|---|---|---|---|---|---|",
  );
  for (const g of c.grades)
    L.push(
      `| ${g.grade} | ${g.curricula.map(curriculumLabel).join(", ") || "—"} | ${g.topics} | ${g.coveredTopics} | ${g.completeTopics} | ${pct(g.completeTopics, g.topics)}% | ${g.topicsWithExercises} | ${g.topicsWithTests} | ${g.approvedTopics} |`,
    );
  L.push("", "## По направления и програми", "");
  for (const t of c.tracks) {
    L.push(
      `### ${t.label} — ${t.completeTopics}/${t.topics} пълни теми (${pct(t.completeTopics, t.topics)}%), одобрени ${t.approvedTopics}`,
      "",
      "| Програма | Теми | С урок | Пълни | С тест | Одобрени |",
      "|---|---|---|---|---|---|",
    );
    for (const cv of t.curricula) L.push(`| ${cv.title} | ${cv.topics} | ${cv.coveredTopics} | ${cv.completeTopics} | ${cv.topicsWithTests} | ${cv.approvedTopics} |`);
    L.push("");
  }
  L.push("", "## Очаквани предмети по етапи — ЧАКА СВЕРКА", "");
  L.push(
    "Списъкът е съставен ръчно по Наредба № 4 от 30.11.2015 г. за учебния план (с измененията) — официалният текст на mon.bg не позволява автоматично изтегляне, затова **трябва да се свери** преди да се използва като меродавен.",
    "",
  );
  for (const st of c.stages) {
    L.push(`### ${st.stage}`, "", "| Предмет | Статус | Бележка |", "|---|---|---|");
    for (const s of st.subjects) L.push(`| ${s.name} | ${ICON[s.status]} ${COVERAGE_LABEL[s.status]} | ${s.note} |`);
    L.push("");
  }
  L.push("## Профилирана подготовка (XI–XII клас) — ЧАКА СВЕРКА", "", "| Профил | Статус | Бележка |", "|---|---|---|");
  for (const p of c.profiles) L.push(`| ${p.name} | ${ICON[p.status]} ${COVERAGE_LABEL[p.status]} | ${p.note} |`);
  L.push("", "## НВО и ДЗИ — ЧАКА СВЕРКА", "", "| Изпит | Статус | Бележка |", "|---|---|---|");
  for (const e of c.exams) L.push(`| ${e.name} | ${ICON[e.status]} ${COVERAGE_LABEL[e.status]} | ${e.note} |`);
  L.push("", "## Следващи стъпки (план)", "");
  L.push(
    "1. **Учебни програми на МОН:** изтегляне на програмите ръчно от mon.bg (сайтът блокира автоматичен достъп) → импорт като документ → сверка на структурата → `isOfficialStructure` само след сверка.",
    "2. **Училища:** CSV експорт от регистъра на институциите (ri.mon.bg), изтеглен ръчно → Админ → Импорт → училищата стават „потвърдени“.",
    "3. **Кандидатстудентски изпити:** за всяко висше училище — официалната страница за прием като източник (тип `ADMISSION_GUIDE`), въвеждане от редактор с година и дата на проверка.",
    "4. **Липсващи предмети и профили:** програми за предметите с ❌ (по сверения списък), после уроци през pipeline-а — винаги с редакторска проверка.",
    "5. **НВО IV и X клас, ДЗИ по избор:** подготвителни курсове по официалните изпитни програми (след ръчно изтегляне от mon.bg).",
  );
  return L.join("\n") + "\n";
}
