/** Помощни функции за време (сървърните компоненти се рендерират веднъж на заявка). */
const DAY = 86_400_000;
export const nowMs = () => Date.now();
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
export const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);
export function startOfMonthUTC() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
