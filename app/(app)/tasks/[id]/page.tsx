import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireEmployee, isManagerRole } from "@/lib/auth";
import { ACTIVITY_SELECT, ASSIGNMENT_SELECT, getEmployees } from "@/lib/queries";
import { clockTime, dueLabel, longDate, shortDate, timeAgo, todayISO } from "@/lib/dates";
import { FREQUENCY_LABEL, KIND_LABEL, OPEN_STATUSES, PRIORITY_LABEL, duration, hours, loggedMinutes } from "@/lib/format";
import { describeActivity } from "@/lib/activity";
import { Avatar, Person, Section, StatusBadge } from "@/components/ui";
import { TaskActions } from "@/components/task-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { DeleteEntryButton } from "@/components/delete-entry";
import { deleteAssignment, updateAssignment } from "@/lib/actions/tasks";
import type { ActivityRow, AssignmentRow, TimeEntry, Template } from "@/lib/types";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireEmployee();
  const manager = isManagerRole(me.role);
  const today = todayISO();

  const { data } = await supabase.from("task_assignments").select(ASSIGNMENT_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const t = data as unknown as AssignmentRow;

  const [entriesRes, activityRes, reviewsRes, templateRes, runningRes, employees] = await Promise.all([
    supabase.from("time_entries").select("*, employee:employees(full_name)").eq("assignment_id", id).order("created_at", { ascending: false }),
    supabase.from("activity_logs").select(ACTIVITY_SELECT).eq("assignment_id", id).order("created_at", { ascending: false }),
    supabase.from("reviews").select("id, decision, comment, created_at, reviewer:employees(full_name)").eq("assignment_id", id).order("created_at", { ascending: false }),
    t.template_id ? supabase.from("task_templates").select("*").eq("id", t.template_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("time_entries").select("id, assignment_id, started_at").eq("employee_id", me.id).eq("source", "timer").is("ended_at", null).maybeSingle(),
    getEmployees(supabase),
  ]);
  const entries = (entriesRes.data ?? []) as (TimeEntry & { employee: { full_name: string } | null })[];
  const activity = (activityRes.data ?? []) as unknown as ActivityRow[];
  const reviews = (reviewsRes.data ?? []) as unknown as { id: string; decision: string; comment: string | null; created_at: string; reviewer: { full_name: string } | null }[];
  const template = templateRes.data as Template | null;
  const running = runningRes.data ? { id: runningRes.data.id, assignment_id: runningRes.data.assignment_id, started_at: runningRes.data.started_at! } : null;
  const names = new Map(employees.map((e) => [e.id, e.full_name]));

  const byKind = { manual: 0, automation: 0, review: 0 } as Record<string, number>;
  for (const e of entries) byKind[e.kind] += loggedMinutes([e]);
  const totalMin = byKind.manual + byKind.automation + byKind.review;
  const due = dueLabel(t.due_date, today);
  const late = due.late && OPEN_STATUSES.includes(t.status);
  const latestRework = reviews.find((r) => r.decision === "rework");

  return (
    <>
      <Link href={manager ? "/tasks" : "/my-work"} className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-graphite hover:text-ink">
        <ChevronLeft size={14} />
        {manager ? "All tasks" : "My tasks"}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} late={late} />
            {t.priority !== "normal" ? <span className="text-xs font-medium text-graphite">{PRIORITY_LABEL[t.priority]} priority</span> : null}
          </div>
          <h1 className="t-title">{t.title}</h1>
          <p className="t-meta mt-1.5">
            <Link href={`/clients/${t.client_id}`} className="link">{t.client?.name}</Link>
            {t.category ? <span className="ml-3">{t.category}</span> : null}
            <span className={`ml-3 num ${late ? "font-medium text-brick" : ""}`}>Due {longDate(t.due_date)}{late ? `, ${due.text}` : ""}</span>
          </p>
        </div>
        <TaskActions
          task={{ id: t.id, title: t.title, status: t.status, assignee_id: t.assignee_id, reviewer_id: t.reviewer_id, automation_url: t.automation_url, sop_url: t.sop_url }}
          meId={me.id}
          isManager={manager}
          running={running}
          size="md"
        />
      </header>

      {t.status === "rework" && latestRework?.comment ? (
        <div className="mb-6 rounded-lg border border-coral/40 bg-coral-soft px-4 py-3 text-[0.8125rem]">
          <p className="font-medium text-brick">Changes requested by {latestRework.reviewer?.full_name ?? "the reviewer"}</p>
          <p className="mt-1 text-ink">{latestRework.comment}</p>
        </div>
      ) : null}

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <Section title="Details">
            <dl className="panel grid grid-cols-1 divide-y divide-rule-soft text-[0.8125rem] sm:grid-cols-2 sm:divide-y-0">
              {[
                ["Assignee", <Person key="a" name={t.assignee?.full_name} />],
                ["Reviewer", <Person key="r" name={t.reviewer?.full_name} muted="No reviewer" />],
                ["Estimate", <span key="e" className="num">{hours(Number(t.estimated_hours))}</span>],
                [
                  "Logged",
                  <span key="l" className={`num ${totalMin / 60 > Number(t.estimated_hours) && Number(t.estimated_hours) > 0 ? "text-brick" : ""}`}>
                    {duration(totalMin)}
                  </span>,
                ],
                ["Repeats", template ? FREQUENCY_LABEL[template.frequency] : "One time"],
                ["Submitted", t.submitted_at ? `${shortDate(t.submitted_at.slice(0, 10))} at ${clockTime(t.submitted_at)}` : "—"],
                ["Automation", t.automation_url ? <a key="au" href={t.automation_url} target="_blank" rel="noreferrer" className="link break-all">{t.automation_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : template?.automation_note ?? "None yet"],
                ["SOP", t.sop_url ? <a key="s" href={t.sop_url} target="_blank" rel="noreferrer" className="link">Open SOP</a> : template?.sop_type ? (template.sop_type === "loom" ? "Loom exists, link not added" : "SOP exists, link not added") : "None"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between gap-4 px-4 py-2.5 sm:border-b sm:border-rule-soft sm:[&:nth-last-child(-n+2)]:border-b-0 sm:odd:border-r">
                  <dt className="text-graphite">{k}</dt>
                  <dd className="min-w-0 text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {t.notes ? <p className="mt-3 rounded-md bg-paper px-4 py-3 text-[0.8125rem] ring-1 ring-rule">{t.notes}</p> : null}
            {template?.raw_time_text ? <p className="hint mt-2">Time in the original task list: “{template.raw_time_text}”</p> : null}
          </Section>

          <Section title="Time" aside={totalMin ? `${duration(byKind.manual)} manual, ${duration(byKind.automation)} automation, ${duration(byKind.review)} review` : undefined}>
            {entries.length === 0 ? (
              <p className="t-meta">No time logged yet. Use Start to run a timer, or Log time to enter it afterwards.</p>
            ) : (
              <div className="panel overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Person</th>
                      <th>Type</th>
                      <th className="r">Time</th>
                      <th>Note</th>
                      <th className="w-8"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td className="num whitespace-nowrap">
                          {shortDate(e.work_date)}
                          {e.started_at ? <span className="ml-2 text-xs text-fog">{clockTime(e.started_at)}{e.ended_at ? `–${clockTime(e.ended_at)}` : ""}</span> : null}
                        </td>
                        <td className="whitespace-nowrap">{e.employee?.full_name}</td>
                        <td className="text-graphite">{KIND_LABEL[e.kind]}</td>
                        <td className="r">{e.ended_at || e.source === "manual" ? duration(e.minutes) : <span className="text-indigo">Running</span>}</td>
                        <td className="max-w-[16rem] truncate text-graphite">{e.note}</td>
                        <td>{e.employee_id === me.id || me.role === "admin" ? <DeleteEntryButton id={e.id} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {manager ? (
            <Section title="Edit task">
              <ActionForm action={updateAssignment} className="panel grid gap-4 p-5 sm:grid-cols-2">
                <input type="hidden" name="id" value={t.id} />
                <label className="field sm:col-span-2">
                  <span className="label">Task</span>
                  <input className="input" name="title" defaultValue={t.title} required />
                </label>
                <label className="field">
                  <span className="label">Assignee</span>
                  <select className="select" name="assignee_id" defaultValue={t.assignee_id ?? ""}>
                    <option value="">Unassigned</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Reviewer</span>
                  <select className="select" name="reviewer_id" defaultValue={t.reviewer_id ?? ""}>
                    <option value="">No reviewer</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Due date</span>
                  <input className="input" type="date" name="due_date" defaultValue={t.due_date} required />
                </label>
                <label className="field">
                  <span className="label">Estimated hours</span>
                  <input className="input num" type="number" step="0.25" min="0" name="estimated_hours" defaultValue={Number(t.estimated_hours)} required />
                </label>
                <label className="field">
                  <span className="label">Priority</span>
                  <select className="select" name="priority" defaultValue={t.priority}>
                    {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Automation link</span>
                  <input className="input" type="url" name="automation_url" defaultValue={t.automation_url ?? ""} />
                </label>
                <label className="field">
                  <span className="label">SOP or Loom link</span>
                  <input className="input" type="url" name="sop_url" defaultValue={t.sop_url ?? ""} />
                </label>
                <label className="field">
                  <span className="label">Notes</span>
                  <input className="input" name="notes" defaultValue={t.notes ?? ""} />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                  <span className="hint">{t.template_id ? "Changes apply to this occurrence only. Edit the recurring task to change every future one." : "This is a one-time task."}</span>
                  <SubmitButton>Save changes</SubmitButton>
                </div>
              </ActionForm>
              <form action={deleteAssignment.bind(null, t.id)} className="mt-3 flex items-center justify-between gap-3">
                <span className="hint">{t.template_id ? "Skipping keeps a record and stops this date from being scheduled again." : "Deleting removes the task and its time entries."}</span>
                <SubmitButton variant="danger" pendingText="Removing…">{t.template_id ? "Skip this occurrence" : "Delete task"}</SubmitButton>
              </form>
              {t.template_id ? (
                <p className="hint mt-3">
                  <Link href={`/templates/${t.template_id}`} className="link">Open the recurring task</Link>
                </p>
              ) : null}
            </Section>
          ) : null}
        </div>

        <Section title="History">
          {activity.length === 0 ? (
            <p className="t-meta">No history yet.</p>
          ) : (
            <ol className="relative ml-3 border-l border-rule">
              {activity.map((a) => (
                <li key={a.id} className="relative pb-4 pl-5 last:pb-0">
                  <span className="absolute -left-[11px] top-0">
                    <Avatar name={a.actor?.full_name ?? "Scheduler"} size={20} />
                  </span>
                  <p className="text-[0.8125rem]">
                    <span className="font-medium">{a.actor?.full_name ?? "Scheduler"}</span> {describeActivity(a, names)}
                  </p>
                  {typeof a.details?.comment === "string" && a.details.comment ? <p className="mt-0.5 text-[0.8125rem] text-graphite">“{a.details.comment}”</p> : null}
                  <time className="text-xs text-fog" dateTime={a.created_at} title={new Date(a.created_at).toLocaleString()}>{timeAgo(a.created_at)}</time>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </>
  );
}
