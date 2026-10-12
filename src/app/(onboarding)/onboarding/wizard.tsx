"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  Car,
  Check,
  GraduationCap,
  Languages,
  Loader2,
  School,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { saveOnboardingAction, type OnboardingData } from "@/app/actions/onboarding";
import { ProgressBar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type Ref = { id: string; name: string; code?: string; city?: string } | null;

type Initial = {
  learnerType: string | null;
  city: string;
  school: Ref;
  schoolNameCustom: string;
  grade: number | null;
  schoolProfile: string;
  foreignLanguages: string[];
  vocationalProfession: Ref;
  vocationalSpecialty: Ref;
  universityId: string;
  facultyId: string;
  program: Ref;
  programNameCustom: string;
  degree: string;
  courseYear: number | null;
  semester: number | null;
  targetUniversityId: string;
  targetProgramText: string;
  targetExamYear: number | null;
  drivingCategoryCode: string;
  goals: string[];
  subjectIds: string[];
};

const TYPES = [
  { id: "SCHOOL", label: "Ученик (1.–12. клас)", Icon: School },
  { id: "LANGUAGE_SCHOOL", label: "Езикова гимназия", Icon: Languages },
  { id: "VOCATIONAL", label: "Професионална гимназия / техникум", Icon: Wrench },
  { id: "UNIVERSITY", label: "Студент", Icon: GraduationCap },
  { id: "APPLICANT", label: "Кандидат-студент", Icon: Target },
  { id: "DRIVING", label: "Шофьорски изпит", Icon: Car },
  { id: "SELF", label: "Уча самостоятелно", Icon: BookOpen },
  { id: "OTHER", label: "Друго", Icon: Briefcase },
];

const LANGS = ["Английски", "Немски", "Френски", "Испански", "Руски", "Италиански", "Китайски", "Японски", "Турски"];

const GOALS = [
  "Високи оценки в училище",
  "НВО в 4. клас",
  "НВО в 7. клас",
  "НВО в 10. клас",
  "Матури (ДЗИ)",
  "Кандидатстване в университет",
  "Изпити в университета",
  "Държавен изпит за професионална квалификация",
  "Шофьорска книжка",
  "Сертификат по чужд език",
  "Курс по първа помощ",
];

const STEPS = ["Какво учиш?", "Къде учиш?", "Какво изучаваш?", "Твоят план"];

export function OnboardingWizard(props: {
  name: string;
  initial: Initial;
  universities: { id: string; name: string; shortName: string | null; city: string }[];
  faculties: { id: string; name: string; universityId: string }[];
  categories: { code: string; name: string }[];
  subjects: { id: string; name: string; category: string; slug: string }[];
  subjectsByGrade: Record<number, string[]>;
  examYears: number[];
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Initial>(props.initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setD((p) => ({ ...p, [k]: v }));

  const t = d.learnerType;
  const isSchool = t === "SCHOOL" || t === "LANGUAGE_SCHOOL" || t === "VOCATIONAL";

  // Предлагани предмети според класа
  const suggested = useMemo(() => {
    if (isSchool && d.grade) return new Set(props.subjectsByGrade[d.grade] ?? []);
    if (t === "VOCATIONAL") return new Set(props.subjects.filter((s) => s.category === "VOCATIONAL").map((s) => s.id));
    if (t === "UNIVERSITY") return new Set(props.subjects.filter((s) => s.category === "UNIVERSITY").map((s) => s.id));
    if (t === "DRIVING") return new Set(props.subjects.filter((s) => s.category === "DRIVING" || s.slug === "parva-pomosht").map((s) => s.id));
    return new Set<string>();
  }, [isSchool, d.grade, t, props.subjectsByGrade, props.subjects]);

  function next() {
    setError(null);
    if (step === 0 && !t) return setError("Избери какво учиш.");
    if (step === 1 && isSchool && !d.grade) return setError("Избери клас.");
    if (step === 1 && t === "DRIVING" && !d.drivingCategoryCode) return setError("Избери категория.");
    if (step === 2 && d.subjectIds.length === 0 && suggested.size > 0) {
      // по подразбиране — всички предложени
      set("subjectIds", [...suggested]);
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function finish() {
    setError(null);
    const payload: OnboardingData = {
      learnerType: (t ?? "SELF") as OnboardingData["learnerType"],
      city: d.city || undefined,
      schoolId: d.school?.id,
      schoolNameCustom: d.school ? undefined : d.schoolNameCustom || undefined,
      grade: d.grade ?? undefined,
      schoolProfile: d.schoolProfile || undefined,
      foreignLanguages: d.foreignLanguages,
      vocationalProfessionId: d.vocationalProfession?.id,
      vocationalSpecialtyId: d.vocationalSpecialty?.id,
      universityId: d.universityId || undefined,
      facultyId: d.facultyId || undefined,
      programId: d.program?.id,
      programNameCustom: d.program ? undefined : d.programNameCustom || undefined,
      degree: (d.degree || undefined) as OnboardingData["degree"],
      courseYear: d.courseYear ?? undefined,
      semester: d.semester ?? undefined,
      targetUniversityId: d.targetUniversityId || undefined,
      targetProgramText: d.targetProgramText || undefined,
      targetExamYear: d.targetExamYear ?? undefined,
      drivingCategoryCode: d.drivingCategoryCode || undefined,
      goals: d.goals,
      subjectIds: d.subjectIds,
    };
    start(async () => {
      const r = await saveOnboardingAction(payload);
      if (r && !r.ok) setError(r.message ?? "Грешка при запазването.");
    });
  }

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm text-muted">
          <span>
            Стъпка {step + 1} от {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <ProgressBar value={((step + 1) / STEPS.length) * 100} label="Напредък в настройката" />
      </div>

      {step === 0 && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Здравей, {props.name}! Какво учиш?</h1>
          <p className="mt-2 text-muted">Ще подредим уроците и тестовете според това. Можеш да промениш всичко по-късно.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TYPES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => set("learnerType", id)}
                aria-pressed={t === id}
                className={cn(
                  "card flex items-center gap-3 p-4 text-left transition-colors",
                  t === id ? "border-primary bg-primary-soft" : "hover:bg-surface-2",
                )}
              >
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", t === id ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-medium">{label}</span>
                {t === id && <Check className="ml-auto h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <h1 className="text-2xl font-semibold tracking-tight">Къде учиш?</h1>
          {(isSchool || t === "APPLICANT") && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="city">
                    Населено място
                  </label>
                  <input id="city" className="input" value={d.city} onChange={(e) => set("city", e.target.value)} placeholder="напр. Пловдив" maxLength={60} />
                </div>
                <div>
                  <label className="label" htmlFor="grade">
                    Клас
                  </label>
                  <select id="grade" className="input" value={d.grade ?? ""} onChange={(e) => set("grade", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— избери —</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}. клас
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {isSchool && (
                <>
                  <SchoolPicker city={d.city} value={d.school} custom={d.schoolNameCustom} onPick={(s) => set("school", s)} onCustom={(v) => set("schoolNameCustom", v)} />
                  <div>
                    <label className="label" htmlFor="profile">
                      Профил или паралелка (по желание)
                    </label>
                    <input
                      id="profile"
                      className="input"
                      maxLength={120}
                      value={d.schoolProfile}
                      onChange={(e) => set("schoolProfile", e.target.value)}
                      placeholder="напр. Математически, Природни науки, Чужди езици…"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {(t === "LANGUAGE_SCHOOL" || t === "SCHOOL") && (
            <fieldset>
              <legend className="label">Чужди езици, които учиш</legend>
              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => {
                  const on = d.foreignLanguages.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("foreignLanguages", on ? d.foreignLanguages.filter((x) => x !== l) : [...d.foreignLanguages, l])}
                      className={cn("chip", on && "border-primary bg-primary-soft text-primary")}
                    >
                      {on && <Check className="h-3.5 w-3.5" />} {l}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {t === "VOCATIONAL" && (
            <VocationalPicker
              profession={d.vocationalProfession}
              specialty={d.vocationalSpecialty}
              onPick={(p, s) => {
                set("vocationalProfession", p);
                set("vocationalSpecialty", s);
              }}
            />
          )}

          {t === "UNIVERSITY" && (
            <UniversityFields d={d} set={set} universities={props.universities} faculties={props.faculties} />
          )}

          {t === "APPLICANT" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="tu">
                  Желано висше училище
                </label>
                <select id="tu" className="input" value={d.targetUniversityId} onChange={(e) => set("targetUniversityId", e.target.value)}>
                  <option value="">— още не съм решил(а) —</option>
                  {props.universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tp">
                  Желана специалност
                </label>
                <input id="tp" className="input" maxLength={120} value={d.targetProgramText} onChange={(e) => set("targetProgramText", e.target.value)} placeholder="напр. Медицина" />
              </div>
              <div>
                <label className="label" htmlFor="ty">
                  Година на кандидатстване
                </label>
                <select id="ty" className="input" value={d.targetExamYear ?? ""} onChange={(e) => set("targetExamYear", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">—</option>
                  {props.examYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {t === "DRIVING" && (
            <div>
              <label className="label" htmlFor="cat">
                Категория
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {props.categories.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    title={c.name}
                    aria-pressed={d.drivingCategoryCode === c.code}
                    onClick={() => set("drivingCategoryCode", c.code)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-center font-semibold",
                      d.drivingCategoryCode === c.code ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
              {d.drivingCategoryCode && <p className="mt-2 text-sm text-muted">{props.categories.find((c) => c.code === d.drivingCategoryCode)?.name}</p>}
            </div>
          )}

          {(t === "SELF" || t === "OTHER") && <p className="text-muted">Чудесно! Можеш да избираш свободно от всички предмети и курсове.</p>}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Какво изучаваш?</h1>
            <p className="mt-2 text-muted">
              {suggested.size ? "Отбелязахме предметите за твоя клас/направление. Махни или добави каквото искаш." : "Избери предметите, които те интересуват."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {props.subjects.map((s) => {
              const on = d.subjectIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5", on ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2")}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={on}
                    onChange={() => set("subjectIds", on ? d.subjectIds.filter((x) => x !== s.id) : [...d.subjectIds, s.id])}
                  />
                  <span className="text-sm">{s.name}</span>
                  {suggested.has(s.id) && <span className="ml-auto text-[11px] text-primary">за теб</span>}
                </label>
              );
            })}
          </div>
          <fieldset>
            <legend className="label">Цели</legend>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => {
                const on = d.goals.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("goals", on ? d.goals.filter((x) => x !== g) : [...d.goals, g])}
                    className={cn("chip", on && "border-primary bg-primary-soft text-primary")}
                  >
                    {on && <Check className="h-3.5 w-3.5" />} {g}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>
      )}

      {step === 3 && (
        <section>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">Готово! Ето твоя план</h1>
          <ul className="card mx-auto mt-6 max-w-lg divide-y divide-border">
            <li className="p-4 text-sm">
              <span className="text-muted">Учиш: </span>
              <strong>{TYPES.find((x) => x.id === t)?.label}</strong>
              {d.grade ? `, ${d.grade}. клас` : ""}
              {d.drivingCategoryCode ? `, категория ${d.drivingCategoryCode}` : ""}
            </li>
            <li className="p-4 text-sm">
              <span className="text-muted">Предмети: </span>
              {d.subjectIds.length ? props.subjects.filter((s) => d.subjectIds.includes(s.id)).map((s) => s.name).join(", ") : "ще избереш по-късно"}
            </li>
            {d.goals.length > 0 && (
              <li className="p-4 text-sm">
                <span className="text-muted">Цели: </span>
                {d.goals.join(", ")}
              </li>
            )}
            <li className="p-4 text-sm text-muted">
              На началната страница ще виждаш уроците си, какво да преговориш днес и резултатите си. Всичко можеш да промениш от
              „Профил и настройки“.
            </li>
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button type="button" className="btn-ghost" disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>
            Напред <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={pending} onClick={finish}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Към моето обучение
          </button>
        )}
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function SchoolPicker({
  city,
  value,
  custom,
  onPick,
  onCustom,
}: {
  city: string;
  value: Ref;
  custom: string;
  onPick: (s: Ref) => void;
  onCustom: (v: string) => void;
}) {
  const [q, setQ] = useState(value?.name ?? custom);
  const dq = useDebounced(q);
  const [items, setItems] = useState<{ id: string; name: string; city: string; verified: boolean }[]>([]);

  useEffect(() => {
    if (value || dq.trim().length < 2) return;
    const ctrl = new AbortController();
    fetch(`/api/schools?q=${encodeURIComponent(dq)}&city=${encodeURIComponent(city)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [dq, city, value]);

  return (
    <div>
      <label className="label" htmlFor="school">
        Училище
      </label>
      <input
        id="school"
        className="input"
        value={q}
        maxLength={160}
        placeholder="Започни да пишеш името (напр. „СУ „Христо Ботев““)…"
        onChange={(e) => {
          setQ(e.target.value);
          onPick(null);
          onCustom(e.target.value);
        }}
        autoComplete="off"
      />
      {!value && items.length > 0 && q.length >= 2 && (
        <ul className="card mt-1 max-h-60 overflow-y-auto p-1" role="listbox">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() => {
                  onPick({ id: s.id, name: s.name, city: s.city });
                  setQ(s.name);
                  setItems([]);
                }}
              >
                {s.name} <span className="text-muted">· {s.city}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-xs text-muted">
        {value ? "✓ Избрано от списъка." : "Ако училището ти липсва, просто напиши името му — ще го добавим (след проверка от редактор)."}
      </p>
    </div>
  );
}

function VocationalPicker({
  profession,
  specialty,
  onPick,
}: {
  profession: Ref;
  specialty: Ref;
  onPick: (p: Ref, s: Ref) => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [res, setRes] = useState<{
    professions: { id: string; code: string; name: string; listVersion: string; area: { name: string } }[];
    specialties: { id: string; code: string; name: string; profession: { id: string; name: string; code: string } }[];
  }>({ professions: [], specialties: [] });

  useEffect(() => {
    if (dq.trim().length < 2) return;
    const ctrl = new AbortController();
    fetch(`/api/vocational?q=${encodeURIComponent(dq)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setRes)
      .catch(() => {});
    return () => ctrl.abort();
  }, [dq]);

  return (
    <div>
      <label className="label" htmlFor="voc">
        Професия или специалност
      </label>
      {(profession || specialty) && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-primary bg-primary-soft px-3 py-2 text-sm">
          <span>
            {specialty ? `${specialty.name} (${specialty.code})` : `${profession?.name} (${profession?.code})`}
          </span>
          <button type="button" className="text-primary underline" onClick={() => onPick(null, null)}>
            Смени
          </button>
        </div>
      )}
      <input
        id="voc"
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="напр. „Автотранспортна техника“, „Програмиране“ или код"
        autoComplete="off"
      />
      {q.length >= 2 && (res.specialties.length > 0 || res.professions.length > 0) && (
        <ul className="card mt-1 max-h-72 overflow-y-auto p-1 text-sm">
          {res.specialties.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  onPick({ id: s.profession.id, name: s.profession.name, code: s.profession.code }, { id: s.id, name: s.name, code: s.code });
                  setQ("");
                }}
              >
                <span className="font-medium">{s.name}</span> <span className="text-muted">· специалност {s.code} · {s.profession.name}</span>
              </button>
            </li>
          ))}
          {res.professions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  onPick({ id: p.id, name: p.name, code: p.code }, null);
                  setQ("");
                }}
              >
                <span className="font-medium">{p.name}</span>{" "}
                <span className="text-muted">
                  · професия {p.code} · {p.listVersion}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-xs text-muted">
        Данните са от официалния Списък на професиите (НАПОО). Учениците, приети в VIII клас преди 2026 г., учат по СППОО-2003 (със
        7-цифрени специалности); от 2026/2027 г. — по СППОО-2024.
      </p>
    </div>
  );
}

function UniversityFields({
  d,
  set,
  universities,
  faculties,
}: {
  d: Initial;
  set: <K extends keyof Initial>(k: K, v: Initial[K]) => void;
  universities: { id: string; name: string }[];
  faculties: { id: string; name: string; universityId: string }[];
}) {
  const facs = faculties.filter((f) => f.universityId === d.universityId);
  const [q, setQ] = useState(d.program?.name ?? d.programNameCustom);
  const dq = useDebounced(q);
  const [items, setItems] = useState<{ id: string; name: string; degree: string; faculty: { name: string } | null }[]>([]);

  useEffect(() => {
    if (!d.universityId || d.program) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({ universityId: d.universityId, q: dq });
    if (d.facultyId) params.set("facultyId", d.facultyId);
    if (d.degree) params.set("degree", d.degree);
    fetch(`/api/programs?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((x) => setItems(x.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [dq, d.universityId, d.facultyId, d.degree, d.program]);

  const DEG: Record<string, string> = {
    PROFESSIONAL_BACHELOR: "Професионален бакалавър",
    BACHELOR: "Бакалавър",
    MASTER: "Магистър",
    DOCTOR: "Доктор",
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="uni">
          Висше училище
        </label>
        <select
          id="uni"
          className="input"
          value={d.universityId}
          onChange={(e) => {
            set("universityId", e.target.value);
            set("facultyId", "");
            set("program", null);
          }}
        >
          <option value="">— избери —</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      {facs.length > 0 && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="fac">
            Факултет
          </label>
          <select id="fac" className="input" value={d.facultyId} onChange={(e) => set("facultyId", e.target.value)}>
            <option value="">— всички —</option>
            {facs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="deg">
          Образователна степен
        </label>
        <select id="deg" className="input" value={d.degree} onChange={(e) => set("degree", e.target.value)}>
          <option value="">—</option>
          {Object.entries(DEG).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="cy">
            Курс
          </label>
          <select id="cy" className="input" value={d.courseYear ?? ""} onChange={(e) => set("courseYear", e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sem">
            Семестър
          </label>
          <select id="sem" className="input" value={d.semester ?? ""} onChange={(e) => set("semester", e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {d.universityId && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="prog">
            Специалност
          </label>
          {d.program ? (
            <div className="flex items-center justify-between rounded-xl border border-primary bg-primary-soft px-3 py-2 text-sm">
              {d.program.name}
              <button type="button" className="text-primary underline" onClick={() => set("program", null)}>
                Смени
              </button>
            </div>
          ) : (
            <>
              <input
                id="prog"
                className="input"
                value={q}
                maxLength={160}
                onChange={(e) => {
                  setQ(e.target.value);
                  set("programNameCustom", e.target.value);
                }}
                placeholder="Търси в регистъра на НАЦИД…"
                autoComplete="off"
              />
              {items.length > 0 && (
                <ul className="card mt-1 max-h-60 overflow-y-auto p-1 text-sm">
                  {items.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                        onClick={() => {
                          set("program", { id: p.id, name: p.name });
                          setQ(p.name);
                        }}
                      >
                        {p.name} <span className="text-muted">· {DEG[p.degree]}{p.faculty ? ` · ${p.faculty.name}` : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
