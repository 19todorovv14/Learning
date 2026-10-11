/**
 * Минути учене по дни (една серия → без легенда; заглавието я назовава).
 * Тънки колони с 4px заобляне към стойността, 2px разстояние, линия на дневната цел,
 * подсказка при посочване и скрита таблица за екранни четци.
 */
export function WeekChart({ days, goal }: { days: { day: string; label: string; minutes: number }[]; goal: number }) {
  const max = Math.max(goal, ...days.map((d) => d.minutes), 1);
  const goalPct = (goal / max) * 100;
  return (
    <figure className="mt-5">
      <figcaption className="sr-only">Минути учене през последните 7 дни</figcaption>
      <div className="relative h-36" aria-hidden>
        <div className="absolute inset-x-0 border-t border-dashed border-border-strong" style={{ bottom: `${goalPct}%` }}>
          <span className="absolute -top-4 right-0 text-[10px] text-muted">цел {goal} мин</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-border">
          {days.map((d, i) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                className={`w-full max-w-9 rounded-t-[4px] transition-colors ${
                  i === days.length - 1 ? "bg-primary" : "bg-primary/55 group-hover:bg-primary/80"
                }`}
                style={{ height: `${Math.max(d.minutes > 0 ? 3 : 0, (d.minutes / max) * 100)}%` }}
              />
              <div className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text shadow-pop group-hover:block">
                {d.label}: <strong>{d.minutes} мин</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] text-center text-[11px] text-muted" aria-hidden>
        {days.map((d) => (
          <span key={d.day} className="flex-1">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Ден</th>
            <th>Минути</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{d.label}</td>
              <td>{d.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
