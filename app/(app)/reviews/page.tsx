import type { Metadata } from "next";
import Link from "next/link";
import { requireEmployee, isManagerRole } from "@/lib/auth";
import { ASSIGNMENT_SELECT } from "@/lib/queries";
import { timeAgo, todayISO } from "@/lib/dates";
import { EmptyState, PageHeader, Section, Tabs } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import type { AssignmentRow } from "@/lib/types";

export const metadata: Metadata = { title: "To review" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { supabase, me } = await requireEmployee();
  const manager = isManagerRole(me.role);
  const view = manager ? ((await searchParams).view ?? "mine") : "mine";
  const today = todayISO();

  let q = supabase.from("task_assignments").select(ASSIGNMENT_SELECT).in("status", ["submitted", "under_review"]).order("submitted_at");
  if (view === "mine") q = q.eq("reviewer_id", me.id);

  const [{ data }, runningRes, recentRes, countsRes] = await Promise.all([
    q,
    supabase.from("time_entries").select("id, assignment_id, started_at").eq("employee_id", me.id).eq("source", "timer").is("ended_at", null).maybeSingle(),
    supabase
      .from("reviews")
      .select("id, decision, comment, created_at, assignment:task_assignments(id, title, client:clients(name), assignee:employees!task_assignments_assignee_id_fkey(full_name))")
      .eq("reviewer_id", me.id)
      .order("created_at", { ascending: false })
      .limit(15),
    manager ? supabase.from("task_assignments").select("reviewer_id").in("status", ["submitted", "under_review"]) : Promise.resolve({ data: [] as { reviewer_id: string | null }[] }),
  ]);
  const tasks = (data as unknown as AssignmentRow[]) ?? [];
  const running = runningRes.data ? { id: runningRes.data.id, assignment_id: runningRes.data.assignment_id, started_at: runningRes.data.started_at! } : null;
  const recent = (recentRes.data ?? []) as unknown as {
    id: string;
    decision: string;
    comment: string | null;
    created_at: string;
    assignment: { id: string; title: string; client: { name: string } | null; assignee: { full_name: string } | null } | null;
  }[];
  const all = countsRes.data ?? [];

  return (
    <>
      <PageHeader title="To review" subtitle="Check finished work. Approve it, or send it back with a note." />
      {manager ? (
        <Tabs
          current={`/reviews?view=${view}`}
          items={[
            { href: "/reviews?view=mine", label: "Mine to check", count: all.filter((r) => r.reviewer_id === me.id).length },
            { href: "/reviews?view=all", label: "Whole team", count: all.length },
          ]}
        />
      ) : null}

      <Section title="Waiting for you" aside={tasks.length ? `${tasks.length} to check` : undefined}>
        {tasks.length ? (
          <TaskList tasks={tasks} today={today} meId={me.id} isManager={manager} running={running} showAssignee />
        ) : (
          <EmptyState title="Nothing to check" body="When someone finishes a task you check, it shows up here." />
        )}
      </Section>

      {recent.length ? (
        <Section title="Your recent decisions">
          <ul className="panel divide-y divide-rule-soft">
            {recent.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-4 py-2.5 text-[0.8125rem]">
                <div className="min-w-0">
                  <p>
                    <span className={r.decision === "approved" ? "font-medium text-green" : "font-medium text-brick"}>{r.decision === "approved" ? "Approved" : "Sent back"}</span>{" "}
                    {r.assignment ? (
                      <Link href={`/tasks/${r.assignment.id}`} className="link">{r.assignment.title}</Link>
                    ) : (
                      "a removed task"
                    )}
                    <span className="text-graphite">
                      {r.assignment?.client ? `, ${r.assignment.client.name}` : ""}
                      {r.assignment?.assignee ? ` by ${r.assignment.assignee.full_name}` : ""}
                    </span>
                  </p>
                  {r.comment ? <p className="mt-0.5 text-graphite">“{r.comment}”</p> : null}
                </div>
                <time className="shrink-0 text-xs text-fog">{timeAgo(r.created_at)}</time>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
