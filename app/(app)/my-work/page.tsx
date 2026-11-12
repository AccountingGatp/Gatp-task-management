import type { Metadata } from "next";
import Link from "next/link";
import { requireEmployee, isManagerRole } from "@/lib/auth";
import { ASSIGNMENT_SELECT, fetchAll, loggedHoursByEmployee } from "@/lib/queries";
import { addDays, endOfWeek, startOfWeek, todayISO, weekLabel } from "@/lib/dates";
import { APP_TIMEZONE } from "@/lib/env";
import { OPEN_STATUSES, hours } from "@/lib/format";
import { EmptyState, PageHeader, Section } from "@/components/ui";
import { CapacityBar, CapacityLabel } from "@/components/capacity-bar";
import { TaskList } from "@/components/task-list";
import type { AssignmentRow } from "@/lib/types";

export const metadata: Metadata = { title: "My tasks" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function MyWorkPage() {
  const { supabase, me } = await requireEmployee();
  const today = todayISO();
  const week = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const nextWeekEnd = addDays(weekEnd, 7);

  const [open, doneThisWeek, toReview, runningRes, logged] = await Promise.all([
    fetchAll<AssignmentRow>((a, b) =>
      supabase.from("task_assignments").select(ASSIGNMENT_SELECT).eq("assignee_id", me.id).in("status", OPEN_STATUSES).lte("due_date", nextWeekEnd).order("due_date").order("id").range(a, b),
    ),
    supabase.from("task_assignments").select(ASSIGNMENT_SELECT).eq("assignee_id", me.id).eq("status", "completed").gte("due_date", week).lte("due_date", weekEnd).order("completed_at", { ascending: false }),
    supabase.from("task_assignments").select(ASSIGNMENT_SELECT).eq("reviewer_id", me.id).neq("assignee_id", me.id).in("status", ["submitted", "under_review"]).order("submitted_at"),
    supabase.from("time_entries").select("id, assignment_id, started_at").eq("employee_id", me.id).eq("source", "timer").is("ended_at", null).maybeSingle(),
    loggedHoursByEmployee(supabase, week, weekEnd),
  ]);

  const done = (doneThisWeek.data as unknown as AssignmentRow[]) ?? [];
  const reviewQueue = (toReview.data as unknown as AssignmentRow[]) ?? [];
  const running = runningRes.data ? { id: runningRes.data.id, assignment_id: runningRes.data.assignment_id, started_at: runningRes.data.started_at! } : null;

  const rework = open.filter((t) => t.status === "rework");
  const waiting = open.filter((t) => t.status === "submitted" || t.status === "under_review");
  const active = open.filter((t) => !["rework", "submitted", "under_review"].includes(t.status));
  const overdue = active.filter((t) => t.due_date < today);
  const dueToday = active.filter((t) => t.due_date === today);
  const laterThisWeek = active.filter((t) => t.due_date > today && t.due_date <= weekEnd);
  const nextWeek = active.filter((t) => t.due_date > weekEnd);

  // Latest rework note per task
  const notes = new Map<string, string>();
  if (rework.length) {
    const { data } = await supabase.from("reviews").select("assignment_id, comment, created_at").in("assignment_id", rework.map((t) => t.id)).eq("decision", "rework").order("created_at", { ascending: false });
    for (const r of data ?? []) if (!notes.has(r.assignment_id) && r.comment) notes.set(r.assignment_id, r.comment);
  }

  const assignedThisWeek = [...open, ...done].filter((t) => t.due_date >= week && t.due_date <= weekEnd).reduce((s, t) => s + Number(t.estimated_hours), 0);
  const loggedMine = logged.get(me.id) ?? 0;
  const firstName = me.full_name.split(" ")[0];
  const manager = isManagerRole(me.role);
  const common = { today, meId: me.id, isManager: manager, running };

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={
          dueToday.length + overdue.length === 0
            ? "Nothing due today."
            : `${dueToday.length} due today${overdue.length ? `, ${overdue.length} overdue` : ""}. ${hours(loggedMine)} logged this week.`
        }
      />

      <div className="panel mb-8 grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
        <div>
          <p className="t-meta">Your week, {weekLabel(week)}</p>
        </div>
        <CapacityBar assigned={assignedThisWeek} logged={loggedMine} capacity={Number(me.weekly_capacity_hours)} />
        <div className="text-[0.8125rem]">
          <CapacityLabel assigned={assignedThisWeek} capacity={Number(me.weekly_capacity_hours)} />
        </div>
      </div>

      <p className="hint -mt-5 mb-8">
        Press <span className="font-medium text-ink">Start</span> when you begin and <span className="font-medium text-ink">Done</span> when you finish. Forgot the timer? Use <span className="font-medium text-ink">Log time</span>.{" "}
        <Link href="/help" className="link">How it works</Link>
      </p>

      {rework.length ? (
        <Section title="Needs changes" aside={`${rework.length} sent back by a reviewer`}>
          <TaskList tasks={rework} {...common} note={(t) => notes.get(t.id)} />
        </Section>
      ) : null}

      {overdue.length ? (
        <Section title="Overdue" aside={<span className="text-brick">{overdue.length} past due</span>}>
          <TaskList tasks={overdue} {...common} />
        </Section>
      ) : null}

      <Section title="Today" aside={dueToday.length ? `${hours(dueToday.reduce((s, t) => s + Number(t.estimated_hours), 0))} estimated` : undefined}>
        {dueToday.length ? (
          <TaskList tasks={dueToday} {...common} />
        ) : (
          <EmptyState title="Nothing due today" body={laterThisWeek.length ? "Get ahead on something due later this week." : "Your manager will assign new work here."} />
        )}
      </Section>

      {reviewQueue.length ? (
        <Section title="To review" aside={<Link href="/reviews" className="link">Open review queue</Link>}>
          <TaskList tasks={reviewQueue} {...common} showAssignee />
        </Section>
      ) : null}

      {laterThisWeek.length ? (
        <Section title="Later this week">
          <TaskList tasks={laterThisWeek} {...common} />
        </Section>
      ) : null}

      {nextWeek.length ? (
        <details className="group mb-8">
          <summary className="mb-3 flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <h2 className="t-section">Next week</h2>
            <span className="t-meta">
              {nextWeek.length} tasks, {hours(nextWeek.reduce((s, t) => s + Number(t.estimated_hours), 0))}
              <span className="ml-2 text-ink underline decoration-mist underline-offset-2 group-open:hidden">Show</span>
              <span className="ml-2 hidden text-ink underline decoration-mist underline-offset-2 group-open:inline">Hide</span>
            </span>
          </summary>
          <TaskList tasks={nextWeek} {...common} />
        </details>
      ) : null}

      {waiting.length ? (
        <Section title="Waiting for review" aside="Submitted, not yet approved">
          <TaskList tasks={waiting} {...common} />
        </Section>
      ) : null}

      {done.length ? (
        <Section title="Done this week" aside={`${done.length} approved`}>
          <TaskList tasks={done} {...common} />
        </Section>
      ) : null}
    </>
  );
}
