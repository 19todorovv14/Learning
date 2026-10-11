import { describe, expect, it } from "vitest";
import { nextReview } from "@/lib/srs";

const fresh = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };
const now = new Date("2026-10-01T10:00:00Z");

describe("SM-2", () => {
  it("„Не знам“ връща картата след 10 минути и увеличава грешките", () => {
    const r = nextReview({ ...fresh, repetitions: 3, intervalDays: 10 }, 0, now);
    expect(r.repetitions).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.dueAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
    expect(r.easeFactor).toBeLessThan(2.5);
  });
  it("интервалите растат при верни отговори", () => {
    let s = { ...fresh };
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = nextReview(s, 2, now);
      intervals.push(r.intervalDays);
      s = r;
    }
    expect(intervals.slice(0, 2)).toEqual([1, 3]);
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
  });
  it("„Лесно“ дава по-дълъг интервал от „Добре“", () => {
    expect(nextReview(fresh, 3, now).intervalDays).toBeGreaterThan(nextReview(fresh, 2, now).intervalDays);
  });
  it("коефициентът на лекота не пада под 1.3", () => {
    let s = { ...fresh };
    for (let i = 0; i < 20; i++) s = nextReview(s, 0, now);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
  it("интервалът е ограничен до 365 дни", () => {
    const r = nextReview({ easeFactor: 3, intervalDays: 300, repetitions: 10, lapses: 0 }, 3, now);
    expect(r.intervalDays).toBeLessThanOrEqual(365);
  });
});
