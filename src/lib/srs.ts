/**
 * Интервално повторение по алгоритъма SM-2 (SuperMemo 2), адаптиран за ученици.
 * Оценки: 0 „Не знам“, 1 „Трудно“, 2 „Добре“, 3 „Лесно“.
 */
export type SrsState = { easeFactor: number; intervalDays: number; repetitions: number; lapses: number };
export type SrsGrade = 0 | 1 | 2 | 3;

const QUALITY: Record<SrsGrade, number> = { 0: 1, 1: 3, 2: 4, 3: 5 };
const MIN_EF = 1.3;

export function nextReview(state: SrsState, grade: SrsGrade, now = new Date()) {
  const q = QUALITY[grade];
  let { easeFactor, intervalDays, repetitions, lapses } = state;
  let dueAt: Date;

  if (q < 3) {
    repetitions = 0;
    lapses += 1;
    intervalDays = 0;
    dueAt = new Date(now.getTime() + 10 * 60 * 1000); // покажи отново след 10 минути
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = grade === 3 ? 3 : 1;
    else if (repetitions === 2) intervalDays = grade === 3 ? 7 : 3;
    else intervalDays = Math.round(Math.max(1, intervalDays) * easeFactor * (grade === 3 ? 1.3 : grade === 1 ? 0.8 : 1));
    intervalDays = Math.min(intervalDays, 365);
    dueAt = new Date(now.getTime() + intervalDays * 24 * 3600 * 1000);
  }
  easeFactor = Math.max(MIN_EF, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { easeFactor: Math.round(easeFactor * 100) / 100, intervalDays, repetitions, lapses, dueAt };
}

/** Карта се смята за „усвоена“, когато интервалът ѝ е поне 21 дни. */
export const MATURE_INTERVAL_DAYS = 21;
