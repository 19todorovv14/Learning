import { describe, expect, it } from "vitest";
import { ContentError, parseLessonFile, splitByHeading } from "@/lib/content/parse-lesson";
import { loadContent } from "@/lib/content/load";
import { serializeLesson } from "@/lib/content/serialize";

const MIN = (extra = "", fm = "") => `---
title: "Тест"
curriculum: c
topic: "Т"
${fm}---

# Обяснение

Текст с формула $a^2$.

# Записки

- точка

# Определения

- **Понятие** — определение
- **Второ** : друго

# Въпроси от учителя

## Какво е?

Отговор.

# Упражнения

## Задача 1 (трудна)

Условие.

### Подсказка

Мисли.

### Решение

Решение.

# Тест

## Колко е 2+2?

- [ ] 3
- [x] 4

> Защото.

## Вярно ли е?

- [x] Вярно
- [ ] Грешно

## Попълни: ___ е столица.

Отговор: София | гр. София

## Пресметни 1/4.

Число: 0,25 ± 0,001

## Свържи.

- a => 1
- b => 2

## Обясни.

Критерии:
- критерий 1
- критерий 2

Примерен отговор: Нещо.
${extra}`;

describe("parseLessonFile", () => {
  it("разпознава всички секции и типове въпроси", () => {
    const l = parseLessonFile("x.md", MIN(), "x");
    expect(l.sections.map((s) => s.kind)).toEqual(["EXPLANATION", "NOTES"]);
    expect(l.terms).toHaveLength(2);
    expect(l.qa[0].question).toBe("Какво е?");
    expect(l.exercises[0]).toMatchObject({ difficulty: 3, hint: "Мисли.", solution: "Решение." });
    expect(l.questions.map((q) => q.type)).toEqual(["SINGLE_CHOICE", "TRUE_FALSE", "FILL_BLANK", "NUMERIC", "MATCHING", "OPEN"]);
    expect(l.questions[0].explanation).toBe("Защото.");
    expect(l.questions[3]).toMatchObject({ numericAnswer: 0.25, numericTolerance: 0.001 });
    expect(l.questions[2].acceptedAnswers).toEqual(["София", "гр. София"]);
    expect(l.questions[5].rubric).toHaveLength(2);
  });

  it("не разделя по # вътре в кодов блок", () => {
    const { blocks } = splitByHeading("# A\n```\n# коментар\n```\n# B\n", 1);
    expect(blocks.map((b) => b.heading)).toEqual(["A", "B"]);
  });

  it("съобщава за липсващ верен отговор и непозната секция", () => {
    const bad = MIN("\n## Без верен\n\n- [ ] а\n- [ ] б\n").replace("# Записки", "# Записки\n\n# Непозната\n\nx\n\n# Записки2");
    try {
      parseLessonFile("bad.md", bad, "bad");
      expect.fail("трябваше да хвърли грешка");
    } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      const msg = (e as ContentError).problems.join("\n");
      expect(msg).toMatch(/няма отбелязан верен отговор/);
      expect(msg).toMatch(/Непозната секция/);
    }
  });

  it("хваща контролни символи от сгрешено YAML екраниране", () => {
    const text = MIN("", 'summary: "\\frac{1}{2}"\n');
    expect(() => parseLessonFile("c.md", text, "c")).toThrow(/контролен символ/);
  });
});

describe("цялото учебно съдържание", () => {
  const bundle = loadContent();
  it("е валидно (без грешки при зареждане)", () => {
    expect(bundle.errors).toEqual([]);
  });
  it("има уроци и всеки урок има тест с поне 3 въпроса", () => {
    expect(bundle.lessons.length).toBeGreaterThan(0);
    for (const l of bundle.lessons) if (l.meta.status !== "DRAFT") expect(l.questions.length, l.file).toBeGreaterThanOrEqual(3);
  });
  it("сериализацията и повторният разбор запазват съдържанието", () => {
    for (const l of bundle.lessons) {
      const md = serializeLesson({
        slug: l.slug,
        title: l.meta.title,
        curriculumSlug: l.meta.curriculum,
        topicTitle: l.meta.topic,
        also: l.meta.also,
        order: 100 + l.meta.order,
        estimatedMinutes: l.meta.minutes,
        summary: l.meta.summary ?? null,
        objectives: l.meta.objectives,
        prerequisites: l.meta.prerequisites,
        keywords: l.meta.keywords,
        status: l.meta.status,
        origin: l.meta.origin,
        isDemo: l.meta.demo,
        authorName: l.meta.author ?? null,
        sourceKeys: l.meta.sources,
        sections: l.sections,
        terms: l.terms,
        qa: l.qa,
        exercises: l.exercises.map((e) => ({ ...e, hint: e.hint ?? null })),
        questions: l.questions.map((q) => ({
          ...q,
          explanation: q.explanation ?? null,
          numericAnswer: q.numericAnswer ?? null,
          numericTolerance: q.numericTolerance ?? null,
          matchingPairs: q.matchingPairs ?? null,
          modelAnswer: q.modelAnswer ?? null,
        })),
      });
      const again = parseLessonFile(l.file, md, l.slug);
      expect(again.sections, l.file).toEqual(l.sections);
      expect(again.terms, l.file).toEqual(l.terms);
      expect(again.questions.map((q) => [q.type, q.prompt, q.options, q.acceptedAnswers, q.numericAnswer]), l.file).toEqual(
        l.questions.map((q) => [q.type, q.prompt, q.options, q.acceptedAnswers, q.numericAnswer]),
      );
    }
  });
});
