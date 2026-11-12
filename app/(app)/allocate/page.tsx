import type { Metadata } from "next";
import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { fetchAll, getAssignmentsDue, getClients, getEmployees, loggedHoursByEmployee, workloadByEmployee } from "@/lib/queries";
import { addDays, endOfWeek, isISODate, shortDate, startOfWeek, todayISO, weekLabel } from "@/lib/dates";
import { hours } from "@/lib/format";
import { Avatar, EmptyState, PageHeader, Section } from "@/components/ui";
import { CapacityBar, CapacityLabel } from "@/components/capacity-bar";
import { QuickAssign } from "@/components/quick-assign";
import { WeekNav } from "@/components/week-nav";
import { AllocateForm, type TemplateOption } from "./allocate-form";

export const metadata: Metadata = { title: "Assign task" };

export default async function AllocatePage({ searchParams }: { searchParams: Promise<{ week?: string; client?: string }> }) {
  const { supabase } = await requireManager();
  const sp = await searchParams;
  const today = todayISO();
  const thisWeek = startOfWeek(today);
  const week = isISODate(sp.week) ? startOfWeek(sp.week) : thisWeek;
  const horizonEnd = addDays(thisWeek, 7 * 10 - 1);

  const [clients, employees, templates, upcoming, weekTasks, logged] = await Promise.all([
    getClients(supabase),
    getEmployees(supabase),
    fetchAll<TemplateOption>((a, b) =>
      supabase
        .from("task_templates")
        .select("id, client_id, title, category, estimated_hours, default_assignee_id, default_reviewer_id, automation_url, sop_url, frequency, weekday, day_of_month")
        .eq("active", true)
        .order("sort_order")
        .range(a, b),
    ),
    fetchAll<{ assignee_id: string | null; due_date: string; estimated_hours: number }>((a, b) =>
      supabase.from("task_assignments").select("assignee_id, due_date, estimated_hours").gte("due_date", thisWeek).lte("due_date", horizonEnd).neq("status", "skipped").not("assignee_id", "is", null).range(a, b),
    ),
    getAssignmentsDue(supabase, week, endOfWeek(week)),
    loggedHoursByEmployee(supabase, week, endOfWeek(week)),
  ]);

  // employee → week → estimated hours
  const load: Record<string, Record<string, number>> = {};
  for (const r of upcoming) {
    const w = startOfWeek(r.due_date);
    load[r.assignee_id!] ??= {};
    load[r.assignee_id!][w] = (load[r.assignee_id!][w] ?? 0) + Number(r.estimated_hours);
  }

  const people = employees.map((e) => ({ id: e.id, full_name: e.full_name, capacity: Number(e.weekly_capacity_hours) }));
  const workloads = workloadByEmployee(employees, weekTasks, logged).sort((a, b) => a.employee.full_name.localeCompare(b.employee.full_name));
  const unassigned = weekTasks.filter((t) => !t.assignee_id && t.status !== "completed");
  const peopleWithLoad = employees.map((e) => ({
    id: e.id,
    full_name: e.full_name,
    label: `${e.full_name} — ${Math.round((workloads.find((w) => w.employee.id === e.id)?.assigned ?? 0) * 10) / 10} / ${e.weekly_capacity_hours} h`,
  }));

  return (
    <>
      <PageHeader title="Assign a task" subtitle="Pick the client, the task, the person and the hours. That's it." />

      <div className="grid gap-x-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Section title="New task">
          <AllocateForm clients={clients.filter((c) => c.status === "active")} people={people} templates={templates} load={load} today={today} initialClient={sp.client} />
        </Section>

        <Section title="Who has time" aside={<WeekNav basePath="/allocate" week={week} thisWeek={thisWeek} />}>
          <ul className="panel divide-y divide-rule-soft">
            {workloads.map((w) => (
              <li key={w.employee.id} className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Link href={`/tasks?assignee=${w.employee.id}&from=${week}&to=${endOfWeek(week)}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <Avatar name={w.employee.full_name} url={w.employee.avatar_url} size={20} />
                    <span className="truncate font-medium">{w.employee.full_name}</span>
                  </Link>
                  <span className="text-[0.8125rem]">
                    <CapacityLabel assigned={w.assigned} capacity={Number(w.employee.weekly_capacity_hours)} />
                  </span>
                </div>
                <CapacityBar assigned={w.assigned} logged={w.logged} capacity={Number(w.employee.weekly_capacity_hours)} compact />
              </li>
            ))}
          </ul>
          <p className="hint mt-2">Hours booked for the week of {weekLabel(week)}. The black line is each person&apos;s weekly limit.</p>
        </Section>
      </div>

      <Section title="Tasks nobody is doing yet" aside={unassigned.length ? `${unassigned.length} this week, ${hours(unassigned.reduce((s, t) => s + Number(t.estimated_hours), 0))}` : undefined}>
        {unassigned.length === 0 ? (
          <EmptyState title="Every task this week has someone on it" />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Client</th>
                  <th>Due</th>
                  <th className="r">Estimate</th>
                  <th>Assign to</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                    </td>
                    <td className="text-graphite">{t.client?.name}</td>
                    <td className="num whitespace-nowrap">{shortDate(t.due_date)}</td>
                    <td className="r">{hours(Number(t.estimated_hours))}</td>
                    <td>
                      <QuickAssign taskId={t.id} value={t.assignee_id} people={peopleWithLoad} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
