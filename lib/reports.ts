import type { SupabaseClient } from "@supabase/supabase-js";
import { actualHours, fetchAll, getAssignmentsDue, getEmployees } from "@/lib/queries";
import { addDays, endOfMonth, startOfMonth, weekdayISO } from "@/lib/dates";
import { OPEN_STATUSES, loggedMinutes } from "@/lib/format";
import type { AssignmentRow, TimeKind } from "@/lib/types";

export type ReportType = "employee" | "client" | "task";

export interface Column {
  key: string;
  label: string;
  numeric?: boolean;
  unit?: "h" | "%";
}

export interface Report {
  columns: Column[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, string | number | null>;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function workdays(from: string, to: string) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (weekdayISO(d) <= 5) n++;
  return n;
}

export async function buildReport(db: SupabaseClient, month: string, type: ReportType, today: string): Promise<Report> {
  const from = startOfMonth(month + "-01");
  const to = endOfMonth(from);
  const tasks = await getAssignmentsDue(db, from, to);

  if (type === "employee") {
    const [employees, entries] = await Promise.all([
      getEmployees(db, { includeInactive: true }),
      fetchAll<{ employee_id: string; minutes: number; kind: TimeKind; started_at: string | null; ended_at: string | null }>((a, b) =>
        db.from("time_entries").select("employee_id, minutes, kind, started_at, ended_at").gte("work_date", from).lte("work_date", to).range(a, b),
      ),
    ]);
    const days = workdays(from, to);
    const rows = employees
      .map((e) => {
        const mine = tasks.filter((t) => t.assignee_id === e.id);
        const done = mine.filter((t) => t.status === "completed");
        const onTime = done.filter((t) => t.completed_at && t.completed_at.slice(0, 10) <= t.due_date).length;
        const logged = entries.filter((x) => x.employee_id === e.id);
        const byKind = (k: TimeKind) => loggedMinutes(logged.filter((x) => x.kind === k)) / 60;
        const total = loggedMinutes(logged) / 60;
        const capacity = (Number(e.weekly_capacity_hours) / 5) * days;
        return {
          name: e.full_name,
          tasks: mine.length,
          completed: done.length,
          on_time: done.length ? Math.round((onTime / done.length) * 100) : null,
          overdue: mine.filter((t) => t.due_date < today && OPEN_STATUSES.includes(t.status)).length,
          estimated: r1(mine.reduce((s, t) => s + Number(t.estimated_hours), 0)),
          manual: r1(byKind("manual")),
          automation: r1(byKind("automation")),
          review: r1(byKind("review")),
          logged: r1(total),
          utilisation: capacity ? Math.round((total / capacity) * 100) : null,
        };
      })
      .filter((r) => r.tasks > 0 || r.logged > 0);
    return {
      columns: [
        { key: "name", label: "Person" },
        { key: "tasks", label: "Tasks", numeric: true },
        { key: "completed", label: "Completed", numeric: true },
        { key: "on_time", label: "On time", numeric: true, unit: "%" },
        { key: "overdue", label: "Overdue", numeric: true },
        { key: "estimated", label: "Estimated", numeric: true, unit: "h" },
        { key: "manual", label: "Manual", numeric: true, unit: "h" },
        { key: "automation", label: "Automation", numeric: true, unit: "h" },
        { key: "review", label: "Review", numeric: true, unit: "h" },
        { key: "logged", label: "Logged", numeric: true, unit: "h" },
        { key: "utilisation", label: "Of capacity", numeric: true, unit: "%" },
      ],
      rows,
      totals: sumRows(rows, ["tasks", "completed", "overdue", "estimated", "manual", "automation", "review", "logged"], "name"),
    };
  }

  if (type === "client") {
    const map = new Map<string, AssignmentRow[]>();
    for (const t of tasks) {
      const k = t.client?.name ?? "Unknown";
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    const rows = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, list]) => {
        const est = list.reduce((s, t) => s + Number(t.estimated_hours), 0);
        const act = list.reduce((s, t) => s + actualHours(t), 0);
        const done = list.filter((t) => t.status === "completed").length;
        return {
          name,
          tasks: list.length,
          completed: done,
          progress: list.length ? Math.round((done / list.length) * 100) : null,
          overdue: list.filter((t) => t.due_date < today && OPEN_STATUSES.includes(t.status)).length,
          estimated: r1(est),
          logged: r1(act),
          variance: r1(act - est),
          staff: [...new Set(list.map((t) => t.assignee?.full_name).filter(Boolean))].join(", "),
        };
      });
    return {
      columns: [
        { key: "name", label: "Client" },
        { key: "tasks", label: "Tasks", numeric: true },
        { key: "completed", label: "Completed", numeric: true },
        { key: "progress", label: "Progress", numeric: true, unit: "%" },
        { key: "overdue", label: "Overdue", numeric: true },
        { key: "estimated", label: "Estimated", numeric: true, unit: "h" },
        { key: "logged", label: "Logged", numeric: true, unit: "h" },
        { key: "variance", label: "Over / under", numeric: true, unit: "h" },
        { key: "staff", label: "Team" },
      ],
      rows,
      totals: sumRows(rows, ["tasks", "completed", "overdue", "estimated", "logged", "variance"], "name"),
    };
  }

  // task-wise
  const map = new Map<string, AssignmentRow[]>();
  for (const t of tasks) {
    const k = `${t.client?.name ?? ""}\u0000${t.title}`;
    map.set(k, [...(map.get(k) ?? []), t]);
  }
  const rows = [...map.entries()]
    .map(([k, list]) => {
      const [client, title] = k.split("\u0000");
      const est = list.reduce((s, t) => s + Number(t.estimated_hours), 0);
      const done = list.filter((t) => t.status === "completed");
      const act = list.reduce((s, t) => s + actualHours(t), 0);
      const doneAct = done.reduce((s, t) => s + actualHours(t), 0);
      return {
        client,
        name: title,
        occurrences: list.length,
        completed: done.length,
        estimated: r1(est),
        logged: r1(act),
        avg_actual: done.length ? Math.round((doneAct / done.length) * 100) / 100 : null,
        est_each: list.length ? Math.round((est / list.length) * 100) / 100 : null,
        variance: r1(act - est),
      };
    })
    .sort((a, b) => b.variance - a.variance || a.client.localeCompare(b.client));
  return {
    columns: [
      { key: "client", label: "Client" },
      { key: "name", label: "Task" },
      { key: "occurrences", label: "Times", numeric: true },
      { key: "completed", label: "Completed", numeric: true },
      { key: "est_each", label: "Estimate each", numeric: true, unit: "h" },
      { key: "avg_actual", label: "Actual each", numeric: true, unit: "h" },
      { key: "estimated", label: "Estimated", numeric: true, unit: "h" },
      { key: "logged", label: "Logged", numeric: true, unit: "h" },
      { key: "variance", label: "Over / under", numeric: true, unit: "h" },
    ],
    rows,
    totals: sumRows(rows, ["occurrences", "completed", "estimated", "logged", "variance"], "client"),
  };
}

function sumRows(rows: Record<string, unknown>[], keys: string[], labelKey: string) {
  const t: Record<string, string | number | null> = { [labelKey]: "Total" };
  for (const k of keys) t[k] = r1(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  return t;
}
