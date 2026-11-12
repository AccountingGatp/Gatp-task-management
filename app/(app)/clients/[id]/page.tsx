import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Send } from "lucide-react";
import { requireEmployee, isManagerRole } from "@/lib/auth";
import { actualHours, fetchAll, getAssignmentsDue } from "@/lib/queries";
import { addMonths, endOfMonth, isISODate, monthLabel, shortDate, startOfMonth, todayISO } from "@/lib/dates";
import { FREQUENCY_SHORT, OPEN_STATUSES, hours } from "@/lib/format";
import { EmptyState, Ledger, PageHeader, Section, StatusBadge } from "@/components/ui";
import { MonthNav } from "@/components/week-nav";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveClient } from "@/lib/actions/admin";
import type { Client, Template } from "@/lib/types";

export const metadata: Metadata = { title: "Client" };

type TemplateRow = Template & { assignee: { full_name: string } | null; reviewer: { full_name: string } | null };

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireEmployee();
  const manager = isManagerRole(me.role);
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const month = sp.month && isISODate(sp.month + "-01") ? sp.month : thisMonth;
  const from = startOfMonth(month + "-01");
  const to = endOfMonth(from);
  const historyFrom = addMonths(from, -5);

  const { data: clientData } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!clientData) notFound();
  const client = clientData as Client;

  const [tasks, history, templates] = await Promise.all([
    getAssignmentsDue(supabase, from, to, (q) => q.eq("client_id", id)),
    fetchAll<{ due_date: string; status: string; estimated_hours: number }>((a, b) =>
      supabase.from("task_assignments").select("due_date, status, estimated_hours").eq("client_id", id).gte("due_date", historyFrom).lte("due_date", to).neq("status", "skipped").range(a, b),
    ),
    fetchAll<TemplateRow>((a, b) =>
      supabase
        .from("task_templates")
        .select("*, assignee:employees!task_templates_default_assignee_id_fkey(full_name), reviewer:employees!task_templates_default_reviewer_id_fkey(full_name)")
        .eq("client_id", id)
        .order("sort_order")
        .range(a, b),
    ),
  ]);

  const done = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.due_date < today && OPEN_STATUSES.includes(t.status)).length;
  const est = tasks.reduce((s, t) => s + Number(t.estimated_hours), 0);
  const act = tasks.reduce((s, t) => s + actualHours(t), 0);

  const staff = new Map<string, { tasks: number; done: number; est: number; act: number }>();
  for (const t of tasks) {
    const k = t.assignee?.full_name ?? "Unassigned";
    const s = staff.get(k) ?? { tasks: 0, done: 0, est: 0, act: 0 };
    s.tasks++;
    if (t.status === "completed") s.done++;
    s.est += Number(t.estimated_hours);
    s.act += actualHours(t);
    staff.set(k, s);
  }

  const months = Array.from({ length: 6 }, (_, i) => addMonths(from, i - 5));
  const perMonth = months.map((m) => {
    const rows = history.filter((h) => h.due_date.slice(0, 7) === m.slice(0, 7));
    return { m, total: rows.length, done: rows.filter((r) => r.status === "completed").length };
  });
  const maxTotal = Math.max(1, ...perMonth.map((p) => p.total));

  return (
    <>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-graphite hover:text-ink">
        <ChevronLeft size={14} />
        Clients
      </Link>
      <PageHeader
        title={client.name}
        subtitle={[client.accounting_software, client.status !== "active" ? (client.status === "paused" ? "Paused" : "Archived") : null].filter(Boolean).join(", ") || `Work for ${monthLabel(from)}`}
        actions={
          <>
            <MonthNav basePath={`/clients/${id}`} month={month} thisMonth={thisMonth} />
            {manager ? (
              <Link href={`/allocate?client=${id}`} className="btn btn-primary">
                <Send size={14} />
                Assign task
              </Link>
            ) : null}
          </>
        }
      />

      <Ledger
        items={[
          { label: "Tasks this month", value: tasks.length },
          { label: "Completed", value: done, note: tasks.length ? `${Math.round((done / tasks.length) * 100)}%` : undefined, tone: done ? "good" : undefined },
          { label: "Overdue", value: overdue, tone: overdue ? "alert" : undefined },
          { label: "Estimated", value: <span className="num">{Math.round(est * 10) / 10}<span className="text-base font-normal text-graphite"> h</span></span> },
          { label: "Logged", value: <span className="num">{Math.round(act * 10) / 10}<span className="text-base font-normal text-graphite"> h</span></span> },
        ]}
      />

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Who worked on it">
          {staff.size === 0 ? (
            <p className="t-meta">Nothing scheduled this month.</p>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th className="r">Tasks</th>
                    <th className="r">Done</th>
                    <th className="r">Estimated</th>
                    <th className="r">Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {[...staff.entries()].map(([name, s]) => (
                    <tr key={name}>
                      <td className="font-medium">{name}</td>
                      <td className="r">{s.tasks}</td>
                      <td className="r">{s.done}</td>
                      <td className="r">{hours(s.est)}</td>
                      <td className="r">{hours(s.act)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Last six months" aside="Completed of scheduled">
          <div className="panel flex h-[11.5rem] items-end gap-3 px-5 pt-5 pb-3">
            {perMonth.map((p) => (
              <div key={p.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="num text-xs text-graphite">{p.total ? `${p.done}/${p.total}` : "—"}</span>
                <div className="relative w-full max-w-10 overflow-hidden rounded-t-md bg-rule-soft" style={{ height: `${(p.total / maxTotal) * 100}%`, minHeight: 2 }}>
                  <div className="absolute inset-x-0 bottom-0 bg-green" style={{ height: p.total ? `${(p.done / p.total) * 100}%` : 0 }} />
                </div>
                <span className={`text-xs ${p.m === from ? "font-semibold" : "text-graphite"}`}>{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(p.m + "T00:00:00Z"))}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title={`Tasks, ${monthLabel(from)}`} aside={`${tasks.length} scheduled`}>
        {tasks.length === 0 ? (
          <EmptyState title="Nothing scheduled this month" />
        ) : (
          <div className="panel max-h-[60vh] overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th className="r">Estimate</th>
                  <th className="r">Logged</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="num whitespace-nowrap">{shortDate(t.due_date)}</td>
                    <td><Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link></td>
                    <td className="whitespace-nowrap">{t.assignee?.full_name ?? <span className="text-fog">Unassigned</span>}</td>
                    <td className="r">{hours(Number(t.estimated_hours))}</td>
                    <td className="r">{hours(actualHours(t))}</td>
                    <td><StatusBadge status={t.status} late={t.due_date < today && OPEN_STATUSES.includes(t.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recurring tasks" aside={manager ? <Link href={`/templates?client=${id}`} className="link">Edit recurring tasks</Link> : `${templates.length} tasks`}>
        {templates.length === 0 ? (
          <EmptyState title="No recurring tasks for this client" />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Repeats</th>
                  <th className="r">Hours each</th>
                  <th>Does it</th>
                  <th>Checks it</th>
                  <th>Automation</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className={t.active ? undefined : "opacity-50"}>
                    <td>
                      {manager ? <Link href={`/templates/${t.id}`} className="font-medium hover:underline">{t.title}</Link> : <span className="font-medium">{t.title}</span>}
                      {t.category ? <span className="ml-2 text-xs text-fog">{t.category}</span> : null}
                    </td>
                    <td className="whitespace-nowrap">{FREQUENCY_SHORT[t.frequency]}</td>
                    <td className="r">{t.estimated_hours != null ? hours(Number(t.estimated_hours)) : <span className="text-fog">—</span>}</td>
                    <td className="whitespace-nowrap">{t.assignee?.full_name ?? <span className="text-fog">—</span>}</td>
                    <td className="whitespace-nowrap text-graphite">{t.reviewer?.full_name ?? "—"}</td>
                    <td className="max-w-[14rem] truncate">
                      {t.automation_url ? <a href={t.automation_url} target="_blank" rel="noreferrer" className="link">Open</a> : <span className="text-graphite">{t.automation_note ?? "—"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {manager ? (
        <Section title="Client settings">
          <ActionForm action={saveClient} className="panel grid max-w-3xl gap-4 p-5 sm:grid-cols-2">
            <input type="hidden" name="id" value={client.id} />
            <label className="field">
              <span className="label">Name</span>
              <input className="input" name="name" defaultValue={client.name} required />
            </label>
            <label className="field">
              <span className="label">Status</span>
              <select className="select" name="status" defaultValue={client.status}>
                <option value="active">Active</option>
                <option value="paused">Paused (no new work is scheduled)</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Accounting software</span>
              <input className="input" name="accounting_software" defaultValue={client.accounting_software ?? ""} placeholder="Xero, QuickBooks Online, QBD…" />
            </label>
            <label className="field">
              <span className="label">Short code</span>
              <input className="input" name="code" defaultValue={client.code ?? ""} placeholder="Optional" />
            </label>
            <label className="field sm:col-span-2">
              <span className="label">Notes</span>
              <textarea className="textarea" name="notes" defaultValue={client.notes ?? ""} />
            </label>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton>Save client</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      ) : null}
    </>
  );
}
