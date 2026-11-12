import type { Metadata } from "next";
import Link from "next/link";
import { Send } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { ACTIVITY_SELECT, ASSIGNMENT_SELECT, actualHours, getAssignmentsDue, getEmployees, loggedHoursByEmployee, workloadByEmployee } from "@/lib/queries";
import { endOfMonth, endOfWeek, isISODate, monthLabel, startOfMonth, startOfWeek, timeAgo, todayISO, dueLabel, weekLabel } from "@/lib/dates";
import { OPEN_STATUSES, hours } from "@/lib/format";
import { describeActivity } from "@/lib/activity";
import { Avatar, EmptyState, Ledger, PageHeader, ProgressLine, Section } from "@/components/ui";
import { CapacityBar, CapacityLabel } from "@/components/capacity-bar";
import { WeekNav } from "@/components/week-nav";
import type { ActivityRow, AssignmentRow } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { supabase } = await requireManager();
  const sp = await searchParams;
  const today = todayISO();
  const thisWeek = startOfWeek(today);
  const week = isISODate(sp.week) ? startOfWeek(sp.week) : thisWeek;
  const weekEnd = endOfWeek(week);
  const monthStart = startOfMonth(week < thisWeek ? week : today);
  const monthEnd = endOfMonth(monthStart);

  const [employees, weekTasks, monthTasks, logged, overdueRes, reviewRes, clientsRes, activityRes] = await Promise.all([
    getEmployees(supabase),
    getAssignmentsDue(supabase, week, weekEnd),
    getAssignmentsDue(supabase, monthStart, monthEnd),
    loggedHoursByEmployee(supabase, week, weekEnd),
    supabase.from("task_assignments").select(ASSIGNMENT_SELECT, { count: "exact" }).lt("due_date", today).in("status", OPEN_STATUSES).order("due_date").limit(8),
    supabase.from("task_assignments").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
    supabase.from("clients").select("id, name").eq("status", "active").order("name"),
    supabase.from("activity_logs").select(ACTIVITY_SELECT).neq("action", "scheduled").order("created_at", { ascending: false }).limit(14),
  ]);

  const overdue = (overdueRes.data as unknown as AssignmentRow[]) ?? [];
  const activity = (activityRes.data as unknown as ActivityRow[]) ?? [];
  const clients = clientsRes.data ?? [];
  const names = new Map(employees.map((e) => [e.id, e.full_name]));

  const workloads = workloadByEmployee(employees, weekTasks, logged)
    .filter((w) => w.assigned > 0 || w.logged > 0 || w.employee.role !== "admin")
    .sort((a, b) => b.assigned / b.employee.weekly_capacity_hours - a.assigned / a.employee.weekly_capacity_hours);
  const completedWeek = weekTasks.filter((t) => t.status === "completed").length;
  const estWeek = weekTasks.reduce((s, t) => s + Number(t.estimated_hours), 0);
  const loggedWeek = [...logged.values()].reduce((s, v) => s + v, 0);
  const unassigned = weekTasks.filter((t) => !t.assignee_id && t.status !== "completed").length;
  const overAllocated = workloads.filter((w) => w.assigned > w.employee.weekly_capacity_hours).length;

  // Client progress for the month
  const byClient = new Map<string, { name: string; total: number; done: number; overdue: number; est: number; actual: number; staff: Set<string> }>();
  for (const c of clients) byClient.set(c.id, { name: c.name, total: 0, done: 0, overdue: 0, est: 0, actual: 0, staff: new Set() });
  for (const t of monthTasks) {
    const c = byClient.get(t.client_id);
    if (!c) continue;
    c.total++;
    if (t.status === "completed") c.done++;
    else if (t.due_date < today) c.overdue++;
    c.est += Number(t.estimated_hours);
    c.actual += actualHours(t);
    if (t.assignee?.full_name) c.staff.add(t.assignee.full_name);
  }
  const clientRows = [...byClient.entries()].filter(([, c]) => c.total > 0).sort((a, b) => b[1].overdue - a[1].overdue || a[1].name.localeCompare(b[1].name));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`All clients and people for the week of ${weekLabel(week)}`}
        actions={
          <>
            <WeekNav basePath="/overview" week={week} thisWeek={thisWeek} />
            <Link href="/allocate" className="btn btn-primary">
              <Send size={14} />
              Assign task
            </Link>
          </>
        }
      />

      <Ledger
        items={[
          { label: "Active clients", value: clients.length, href: "/clients" },
          { label: "Tasks this week", value: weekTasks.length, note: unassigned ? `${unassigned} without an owner` : `${completedWeek} completed`, href: `/tasks?from=${week}&to=${weekEnd}` },
          { label: "Completed", value: completedWeek, note: weekTasks.length ? `${Math.round((completedWeek / weekTasks.length) * 100)}% of the week` : undefined, tone: completedWeek > 0 ? "good" : undefined, href: `/tasks?from=${week}&to=${weekEnd}&status=completed` },
          { label: "Overdue", value: overdueRes.count ?? 0, note: "Past due and still open", tone: (overdueRes.count ?? 0) > 0 ? "alert" : undefined, href: "/tasks?overdue=1" },
          { label: "Waiting for review", value: reviewRes.count ?? 0, href: "/reviews" },
          { label: "Hours this week", value: <span>{Math.round(loggedWeek)}<span className="text-base font-normal text-graphite"> / {Math.round(estWeek)}</span></span>, note: "Logged of estimated" },
        ]}
      />

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="Team workload" aside={overAllocated ? <span className="text-brick">{overAllocated} over capacity</span> : "Estimated hours due this week"}>
          {workloads.length === 0 ? (
            <EmptyState title="No team members yet" body="Add people on the Team page, then assign work to them." />
          ) : (
            <ul className="panel divide-y divide-rule-soft">
              {workloads.map((w) => (
                <li key={w.employee.id}>
                  <Link href={`/tasks?assignee=${w.employee.id}&from=${week}&to=${weekEnd}`} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-canvas sm:grid-cols-[9rem_minmax(0,1fr)_10.5rem]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={w.employee.full_name} url={w.employee.avatar_url} size={24} />
                      <span className="truncate font-medium">{w.employee.full_name}</span>
                    </span>
                    <CapacityBar assigned={w.assigned} logged={w.logged} capacity={Number(w.employee.weekly_capacity_hours)} />
                    <span className="col-span-2 flex items-center justify-between gap-3 text-[0.8125rem] sm:col-span-1 sm:justify-end">
                      <CapacityLabel assigned={w.assigned} capacity={Number(w.employee.weekly_capacity_hours)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="hint mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-ink" />Logged</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-mist" />Still to do</span>
            <span className="inline-flex items-center gap-1.5"><span className="over-hatch h-2 w-3 rounded-sm" />Over capacity</span>
            <span>Ticks mark 8-hour days</span>
          </p>
        </Section>

        <Section title="Overdue" aside={(overdueRes.count ?? 0) > overdue.length ? <Link href="/tasks?overdue=1" className="link">See all {overdueRes.count}</Link> : null}>
          {overdue.length === 0 ? (
            <EmptyState title="Nothing overdue" body="Every open task is on schedule." />
          ) : (
            <ul className="panel divide-y divide-rule-soft">
              {overdue.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="block px-4 py-2.5 transition-colors hover:bg-canvas">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="num shrink-0 text-xs font-medium text-brick">{dueLabel(t.due_date, today).text}</span>
                    </span>
                    <span className="t-meta mt-0.5 flex justify-between gap-3">
                      <span className="truncate">{t.client?.name}</span>
                      <span className="shrink-0">{t.assignee?.full_name ?? "Unassigned"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title={`Client progress, ${monthLabel(monthStart)}`} aside={<Link href="/clients" className="link">All clients</Link>}>
        {clientRows.length === 0 ? (
          <EmptyState title="No work scheduled this month" body="Open Recurring tasks and press Schedule to fill the calendar." action={<Link href="/templates" className="btn">Open Recurring tasks</Link>} />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="w-[28%]">Completed</th>
                  <th className="r">Open</th>
                  <th className="r">Overdue</th>
                  <th className="r">Estimated</th>
                  <th className="r">Logged</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map(([id, c]) => (
                  <tr key={id}>
                    <td>
                      <Link href={`/clients/${id}`} className="font-medium hover:underline">{c.name}</Link>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <ProgressLine value={c.done} total={c.total} tone="green" />
                        <span className="num w-14 shrink-0 text-right text-xs text-graphite">{c.done} / {c.total}</span>
                      </div>
                    </td>
                    <td className="r">{c.total - c.done}</td>
                    <td className={`r ${c.overdue ? "font-medium text-brick" : "text-fog"}`}>{c.overdue}</td>
                    <td className="r">{hours(c.est)}</td>
                    <td className="r">{hours(c.actual)}</td>
                    <td className="text-graphite">{[...c.staff].join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent activity">
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" body="When people start, submit or review tasks it shows up here." />
        ) : (
          <ol className="panel divide-y divide-rule-soft">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <Avatar name={a.actor?.full_name ?? "System"} size={22} />
                <div className="min-w-0 flex-1 text-[0.8125rem]">
                  <p>
                    <span className="font-medium">{a.actor?.full_name ?? "Scheduler"}</span>{" "}
                    {(() => {
                      const phrase = describeActivity(a, names);
                      if (!a.assignment) return phrase;
                      const link = <Link href={`/tasks/${a.assignment.id}`} className="link">{a.assignment.title}</Link>;
                      const m = phrase.match(/^(.*?)\bit\b(.*)$/);
                      return (
                        <>
                          {m ? <>{m[1]}{link}{m[2]}</> : <>{phrase} on {link}</>}
                          <span className="text-graphite">, {a.assignment.client?.name}</span>
                        </>
                      );
                    })()}
                  </p>
                  {typeof a.details?.comment === "string" && a.details.comment && a.to_status === "rework" ? <p className="mt-0.5 text-graphite">“{a.details.comment}”</p> : null}
                </div>
                <time className="shrink-0 text-xs text-fog" dateTime={a.created_at}>{timeAgo(a.created_at)}</time>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
