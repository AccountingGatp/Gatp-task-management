import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, weekLabel } from "@/lib/dates";

export function WeekNav({ basePath, week, thisWeek, params = {} }: { basePath: string; week: string; thisWeek: string; params?: Record<string, string> }) {
  const href = (w: string) => {
    const q = new URLSearchParams({ ...params, week: w });
    return `${basePath}?${q.toString()}`;
  };
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Week">
      <Link href={href(addDays(week, -7))} className="btn btn-icon" aria-label="Previous week">
        <ChevronLeft size={16} />
      </Link>
      <span className="num min-w-[7.5rem] text-center text-[0.8125rem] font-medium">{weekLabel(week)}</span>
      <Link href={href(addDays(week, 7))} className="btn btn-icon" aria-label="Next week">
        <ChevronRight size={16} />
      </Link>
      {week !== thisWeek ? (
        <Link href={href(thisWeek)} className="btn ml-1">
          This week
        </Link>
      ) : null}
    </div>
  );
}

export function MonthNav({ basePath, month, thisMonth, params = {} }: { basePath: string; month: string; thisMonth: string; params?: Record<string, string> }) {
  const shift = (m: string, n: number) => {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    return d.toISOString().slice(0, 7);
  };
  const href = (m: string) => `${basePath}?${new URLSearchParams({ ...params, month: m }).toString()}`;
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month + "-01T00:00:00Z"));
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Month">
      <Link href={href(shift(month, -1))} className="btn btn-icon" aria-label="Previous month">
        <ChevronLeft size={16} />
      </Link>
      <span className="min-w-[8.5rem] text-center text-[0.8125rem] font-medium">{label}</span>
      <Link href={href(shift(month, 1))} className="btn btn-icon" aria-label="Next month">
        <ChevronRight size={16} />
      </Link>
      {month !== thisMonth ? (
        <Link href={href(thisMonth)} className="btn ml-1">
          This month
        </Link>
      ) : null}
    </div>
  );
}
