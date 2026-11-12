import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Send } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { ASSIGNMENT_SELECT, actualHours, fetchAll, getClients, getEmployees } from "@/lib/queries";
import { addDays, dueLabel, endOfWeek, isISODate, shortDate, startOfWeek, todayISO } from "@/lib/dates";
import { OPEN_STATUSES, STATUS_LABEL, STATUS_ORDER, hours } from "@/lib/format";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import type { AssignmentRow, Status } from "@/lib/types";

export const metadata: Metadata = { title: "All tasks" };

type SP = { q?: string; client?: string; assignee?: string; status?: string; from?: string; to?: string; overdue?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase } = await requireManager();
  const sp = await searchParams;
  const today = todayISO();
  const overdue = sp.overdue === "1";
  const from = isISODate(sp.from) ? sp.from : startOfWeek(today);
  const to = isISODate(sp.to) ? sp.to : addDays(endOfWeek(today), 7);
  const status = STATUS_ORDER.includes(sp.status as Status) ? (sp.status as Status) : undefined;

  const [clients, employees, tasks] = await Promise.all([
    getClients(supabase, { includeArchived: true }),
    getEmployees(supabase, { includeInactive: true }),
    fetchAll<AssignmentRow>((a, b) => {
      let q = supabase.from("task_assignments").select(ASSIGNMENT_SELECT).order("due_date").order("id").range(a, b);
      if (overdue) q = q.lt("due_date", today).in("status", OPEN_STATUSES);
      else q = q.gte("due_date", from).lte("due_date", to);
      if (status) q = q.eq("status", status);
      else if (!overdue) q = q.neq("status", "skipped");
      if (sp.client) q = q.eq("client_id", sp.client);
      if (sp.assignee === "none") q = q.is("assignee_id", null);
      else if (sp.assignee) q = q.eq("assignee_id", sp.assignee);
      if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_]/g, "")}%`);
      return q;
    }),
  ]);

  const est = tasks.reduce((s, t) => s + Number(t.estimated_hours), 0);
  const act = tasks.reduce((s, t) => s + actualHours(t), 0);
  const done = tasks.filter((t) => t.status === "completed").length;

  return (
    <>
      <PageHeader
        title={overdue ? "Overdue tasks" : "All tasks"}
        subtitle={overdue ? "Past their due date and still open." : `Due ${shortDate(from)} to ${shortDate(to)}`}
        actions={
          <Link href="/allocate" className="btn btn-primary">
            <Send size={14} />
            Assign task
          </Link>
        }
      />

      <form className="panel mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto_auto_auto] lg:items-end" method="get">
        <label className="field">
          <span className="label">Search</span>
          <input className="input" name="q" defaultValue={sp.q} placeholder="Task name" />
        </label>
        <label className="field">
          <span className="label">Client</span>
          <select className="select" name="client" defaultValue={sp.client ?? ""}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Assignee</span>
          <select className="select" name="assignee" defaultValue={sp.assignee ?? ""}>
            <option value="">Everyone</option>
            <option value="none">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select className="select" name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        {overdue ? <input type="hidden" name="overdue" value="1" /> : null}
        <label className="field">
          <span className="label">From</span>
          <input className="input" type="date" name="from" defaultValue={from} disabled={overdue} />
        </label>
        <label className="field">
          <span className="label">To</span>
          <input className="input" type="date" name="to" defaultValue={to} disabled={overdue} />
        </label>
        <div className="flex gap-2">
          <button className="btn btn-primary">Filter</button>
          <Link href={overdue ? "/tasks" : "/tasks?overdue=1"} className="btn">
            {overdue ? "All tasks" : "Overdue"}
          </Link>
        </div>
      </form>

      <p className="t-meta mb-3 num">
        {tasks.length} tasks, {done} completed. {hours(est)} estimated, {hours(act)} logged.
      </p>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks match these filters" body="Widen the dates or clear a filter." action={<Link href="/tasks" className="btn">Clear filters</Link>} />
      ) : (
        <div className="panel max-h-[70vh] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Client</th>
                <th>Assignee</th>
                <th>Reviewer</th>
                <th>Due</th>
                <th className="r">Estimate</th>
                <th className="r">Logged</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const due = dueLabel(t.due_date, today);
                const late = due.late && OPEN_STATUSES.includes(t.status);
                const a = actualHours(t);
                return (
                  <tr key={t.id}>
                    <td className="max-w-[22rem]">
                      <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                      {t.category ? <span className="ml-2 text-xs text-fog">{t.category}</span> : null}
                    </td>
                    <td className="whitespace-nowrap text-graphite">{t.client?.name}</td>
                    <td className="whitespace-nowrap">{t.assignee?.full_name ?? <span className="text-fog">Unassigned</span>}</td>
                    <td className="whitespace-nowrap text-graphite">{t.reviewer?.full_name ?? "—"}</td>
                    <td className={clsx("num whitespace-nowrap", late && "font-medium text-brick")}>{late ? due.text : shortDate(t.due_date)}</td>
                    <td className="r">{hours(Number(t.estimated_hours))}</td>
                    <td className={clsx("r", a > Number(t.estimated_hours) && Number(t.estimated_hours) > 0 && "text-brick")}>{hours(a)}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
