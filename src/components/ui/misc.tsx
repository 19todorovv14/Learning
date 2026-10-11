import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const ALERT = {
  info: { cls: "bg-info-soft text-info border-info/25", Icon: Info },
  success: { cls: "bg-success-soft text-success border-success/25", Icon: CheckCircle2 },
  warning: { cls: "bg-warning-soft text-warning border-warning/30", Icon: AlertTriangle },
  error: { cls: "bg-danger-soft text-danger border-danger/25", Icon: XCircle },
};

export function Alert({
  kind = "info",
  title,
  children,
  className,
}: {
  kind?: keyof typeof ALERT;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = ALERT[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title && "mt-0.5", "text-text-2")}>{children}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
