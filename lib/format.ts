import type { Frequency, Priority, Status, TimeKind, Template } from "@/lib/types";

/** 1.5 → "1.5 h", 0.25 → "0.25 h", 1.03 → "1 h", 0 → "0 h" */
export function hours(h: number | null | undefined, digits = 1): string {
  const v = Number(h ?? 0);
  if (!Number.isFinite(v)) return "0 h";
  const places = Math.abs(v) < 1 ? 2 : digits;
  return `${parseFloat(v.toFixed(places))} h`;
}

export function minutesToHours(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

/** 95 → "1 h 35 min" */
export function duration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

export const STATUS_LABEL: Record<Status, string> = {
  assigned: "To do",
  in_progress: "In progress",
  submitted: "Waiting for review",
  under_review: "Being reviewed",
  rework: "Needs changes",
  completed: "Completed",
  skipped: "Skipped",
};

export const STATUS_ORDER: Status[] = ["assigned", "in_progress", "submitted", "under_review", "rework", "completed", "skipped"];

export const OPEN_STATUSES: Status[] = ["assigned", "in_progress", "submitted", "under_review", "rework"];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Daily (Mon–Fri)",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  one_time: "One time",
  as_needed: "As needed",
};

export const FREQUENCY_SHORT: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  one_time: "One time",
  as_needed: "As needed",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const KIND_LABEL: Record<TimeKind, string> = {
  manual: "Doing the task",
  automation: "Running the automation",
  review: "Checking",
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function loggedMinutes(entries: { minutes: number; started_at: string | null; ended_at: string | null }[] | undefined, now = Date.now()) {
  if (!entries) return 0;
  return entries.reduce((sum, e) => {
    const running = e.started_at && !e.ended_at ? Math.max(0, (now - new Date(e.started_at).getTime()) / 60000) : 0;
    return sum + e.minutes + running;
  }, 0);
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong. Try again.";
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function scheduleText(t: Pick<Template, "frequency" | "weekday" | "day_of_month">) {
  if ((t.frequency === "weekly" || t.frequency === "biweekly") && t.weekday) return `${FREQUENCY_SHORT[t.frequency]}, ${WEEKDAYS[t.weekday - 1].slice(0, 3)}`;
  if (["monthly", "quarterly", "yearly"].includes(t.frequency) && t.day_of_month) return `${FREQUENCY_SHORT[t.frequency]}, day ${t.day_of_month}`;
  return FREQUENCY_SHORT[t.frequency];
}
