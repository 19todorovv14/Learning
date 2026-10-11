import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Път" className="mb-3 overflow-x-auto">
      <ol className="flex items-center gap-1 whitespace-nowrap text-sm text-muted">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            {c.href ? (
              <Link href={c.href} className="hover:text-text">
                {c.label}
              </Link>
            ) : (
              <span className="text-text-2">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  kicker,
  crumbs,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  kicker?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {kicker && <div className="kicker mb-1.5">{kicker}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-[28px]">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
