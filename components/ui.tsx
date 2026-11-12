import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { Status } from "@/lib/types";
import { STATUS_LABEL, initials } from "@/lib/format";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1f1f23" />
      <path d="M9 11h14M9 16h9M9 21h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22.5" cy="21" r="3" fill="#f67373" />
    </svg>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="t-title">{title}</h1>
        {subtitle ? <p className="t-meta mt-1.5">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("mb-8", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="t-section">{title}</h2>
        {aside ? <div className="t-meta">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  assigned: "bg-rule-soft text-graphite",
  in_progress: "bg-indigo-soft text-indigo",
  submitted: "bg-amber-soft text-amber",
  under_review: "bg-amber-soft text-amber",
  rework: "bg-coral-soft text-brick",
  completed: "bg-green-soft text-green",
  skipped: "bg-rule-soft text-fog line-through",
};

export function StatusBadge({ status, late }: { status: Status; late?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx("inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-medium whitespace-nowrap", STATUS_STYLE[status])}>
        {STATUS_LABEL[status]}
      </span>
      {late ? <span className="text-[0.6875rem] font-medium text-brick">Overdue</span> : null}
    </span>
  );
}

export function Avatar({ name, url, size = 24 }: { name: string | null | undefined; url?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full" referrerPolicy="no-referrer" />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-rule-soft font-semibold text-graphite"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export function Person({ name, muted }: { name: string | null | undefined; muted?: string }) {
  if (!name) return <span className="text-fog">{muted ?? "Unassigned"}</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Avatar name={name} size={20} />
      {name}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-2 px-5 py-8">
      <p className="font-medium">{title}</p>
      {body ? <p className="t-meta max-w-prose">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Horizontal strip of figures separated by hairlines — one panel, not a row of cards. */
export function Ledger({ items }: { items: { label: string; value: ReactNode; note?: ReactNode; tone?: "alert" | "good"; href?: string }[] }) {
  return (
    <div className="panel mb-8 grid grid-cols-2 overflow-hidden sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
      {items.map((it) => {
        const body = (
          <>
            <span className="t-meta">{it.label}</span>
            <span className={clsx("t-figure mt-2", it.tone === "alert" && "text-brick", it.tone === "good" && "text-green")}>{it.value}</span>
            {it.note ? <span className="mt-1.5 text-xs text-graphite">{it.note}</span> : null}
          </>
        );
        const cls = "flex flex-col border-rule-soft px-4 py-4 [&:not(:last-child)]:border-r max-lg:border-b";
        return it.href ? (
          <Link key={it.label} href={it.href} className={clsx(cls, "transition-colors hover:bg-canvas")}>
            {body}
          </Link>
        ) : (
          <div key={it.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-rule-soft p-1" aria-label="Views">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={clsx(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
            t.href === current ? "bg-paper text-ink shadow-[var(--shadow-1)]" : "text-graphite hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="num text-xs text-fog">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function ProgressLine({ value, total, tone = "ink" }: { value: number; total: number; tone?: "ink" | "green" }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule-soft" role="img" aria-label={`${value} of ${total}`}>
      <div className={clsx("h-full rounded-full", tone === "green" ? "bg-green" : "bg-ink")} style={{ width: `${pct}%` }} />
    </div>
  );
}
