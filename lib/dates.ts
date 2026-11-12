import { APP_TIMEZONE } from "@/lib/env";

// All dates in the app are plain ISO dates (YYYY-MM-DD) in the company time zone.

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toUTC(v).getTime());
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** Monday of the week containing iso */
export function startOfWeek(iso: string): string {
  const d = toUTC(iso);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}

export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function endOfMonth(iso: string): string {
  const d = toUTC(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fromUTC(d);
}

export function addMonths(iso: string, months: number): string {
  const d = toUTC(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + months);
  return fromUTC(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function weekdayISO(iso: string): number {
  return ((toUTC(iso).getUTCDay() + 6) % 7) + 1; // 1 = Monday
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts });

/** "Thu 12 Nov" */
export function shortDate(iso: string): string {
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(toUTC(iso));
}

/** "12 Nov 2026" */
export function longDate(iso: string): string {
  return fmt({ day: "numeric", month: "short", year: "numeric" }).format(toUTC(iso));
}

/** "November 2026" */
export function monthLabel(iso: string): string {
  return fmt({ month: "long", year: "numeric" }).format(toUTC(iso));
}

/** "9–15 Nov" */
export function weekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const a = toUTC(weekStart);
  const b = toUTC(end);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const left = sameMonth ? String(a.getUTCDate()) : fmt({ day: "numeric", month: "short" }).format(a);
  return `${left}–${fmt({ day: "numeric", month: "short" }).format(b)}`;
}

/** Due date relative to today: "Today", "Tomorrow", "3 days late", "Mon 16 Nov" */
export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const diff = daysBetween(today, due);
  if (diff === 0) return { text: "Today", late: false };
  if (diff === 1) return { text: "Tomorrow", late: false };
  if (diff === -1) return { text: "1 day late", late: true };
  if (diff < -1) return { text: `${-diff} days late`, late: true };
  return { text: shortDate(due), late: false };
}

export function timeAgo(ts: string): string {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function clockTime(ts: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}
