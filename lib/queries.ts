import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentRow, Employee, Client, ActivityRow } from "@/lib/types";
import { loggedMinutes } from "@/lib/format";

export const ASSIGNMENT_SELECT =
  "*, client:clients(id,name), assignee:employees!task_assignments_assignee_id_fkey(id,full_name), reviewer:employees!task_assignments_reviewer_id_fkey(id,full_name), time_entries(minutes,kind,started_at,ended_at,employee_id)";

export const ACTIVITY_SELECT =
  "id, assignment_id, action, from_status, to_status, details, created_at, actor:employees!activity_logs_actor_id_fkey(id,full_name), assignment:task_assignments(id,title,client:clients(name))";

type DB = SupabaseClient;

/** PostgREST caps responses (1000 rows by default), so page through large ranges. */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data as T[]) ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export async function getEmployees(db: DB, { includeInactive = false } = {}): Promise<Employee[]> {
  let q = db.from("employees").select("*").order("full_name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data as Employee[]) ?? [];
}

export async function getClients(db: DB, { includeArchived = false } = {}): Promise<Client[]> {
  let q = db.from("clients").select("*").order("name");
  if (!includeArchived) q = q.neq("status", "archived");
  const { data } = await q;
  return (data as Client[]) ?? [];
}

export async function getAssignmentsDue(db: DB, from: string, to: string, extra?: (q: any) => any): Promise<AssignmentRow[]> {
  return fetchAll<AssignmentRow>((a, b) => {
    let q = db
      .from("task_assignments")
      .select(ASSIGNMENT_SELECT)
      .gte("due_date", from)
      .lte("due_date", to)
      .neq("status", "skipped")
      .order("due_date")
      .order("id")
      .range(a, b);
    if (extra) q = extra(q);
    return q;
  });
}

export async function getRecentActivity(db: DB, limit = 12): Promise<ActivityRow[]> {
  const { data } = await db.from("activity_logs").select(ACTIVITY_SELECT).order("created_at", { ascending: false }).limit(limit);
  return (data as unknown as ActivityRow[]) ?? [];
}

export function actualHours(a: AssignmentRow): number {
  return loggedMinutes(a.time_entries) / 60;
}

export interface Workload {
  employee: Employee;
  assigned: number; // estimated hours due this week
  logged: number; // hours actually logged this week
  open: number;
  done: number;
}

/** Estimated hours per employee for the assignments in a week. */
export function workloadByEmployee(employees: Employee[], weekAssignments: AssignmentRow[], loggedByEmployee: Map<string, number>): Workload[] {
  const map = new Map<string, Workload>();
  for (const e of employees) map.set(e.id, { employee: e, assigned: 0, logged: loggedByEmployee.get(e.id) ?? 0, open: 0, done: 0 });
  for (const a of weekAssignments) {
    if (!a.assignee_id) continue;
    const w = map.get(a.assignee_id);
    if (!w) continue;
    w.assigned += Number(a.estimated_hours) || 0;
    if (a.status === "completed") w.done++;
    else w.open++;
  }
  return [...map.values()];
}

export async function loggedHoursByEmployee(db: DB, from: string, to: string): Promise<Map<string, number>> {
  const rows = await fetchAll<{ employee_id: string; minutes: number; started_at: string | null; ended_at: string | null }>((a, b) =>
    db.from("time_entries").select("employee_id, minutes, started_at, ended_at").gte("work_date", from).lte("work_date", to).range(a, b),
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.employee_id, (map.get(r.employee_id) ?? 0) + loggedMinutes([r]) / 60);
  return map;
}
