import type { Metadata } from "next";
import Link from "next/link";
import { requireEmployee, isManagerRole } from "@/lib/auth";
import { actualHours, getAssignmentsDue, getClients } from "@/lib/queries";
import { endOfMonth, isISODate, monthLabel, startOfMonth, todayISO } from "@/lib/dates";
import { hours } from "@/lib/format";
import { EmptyState, PageHeader, ProgressLine } from "@/components/ui";
import { MonthNav } from "@/components/week-nav";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveClient } from "@/lib/actions/admin";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { supabase, me } = await requireEmployee();
  const manager = isManagerRole(me.role);
  const sp = await searchParams;
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const month = sp.month && isISODate(sp.month + "-01") ? sp.month : thisMonth;
  const from = startOfMonth(month + "-01");
  const to = endOfMonth(from);

  const [clients, tasks, templatesRes] = await Promise.all([
    getClients(supabase, { includeArchived: true }),
    getAssignmentsDue(supabase, from, to),
    supabase.from("task_templates").select("client_id").eq("active", true),
  ]);
  const templateCount = new Map<string, number>();
  for (const t of templatesRes.data ?? []) templateCount.set(t.client_id, (templateCount.get(t.client_id) ?? 0) + 1);

  const stats = new Map<string, { total: number; done: number; overdue: number; est: number; actual: number; staff: Set<string> }>();
  for (const t of tasks) {
    const s = stats.get(t.client_id) ?? { total: 0, done: 0, overdue: 0, est: 0, actual: 0, staff: new Set<string>() };
    s.total++;
    if (t.status === "completed") s.done++;
    else if (t.due_date < today) s.overdue++;
    s.est += Number(t.estimated_hours);
    s.actual += actualHours(t);
    if (t.assignee?.full_name) s.staff.add(t.assignee.full_name);
    stats.set(t.client_id, s);
  }

  return (
    <>
      <PageHeader title="Clients" subtitle={`Progress for ${monthLabel(from)}`} actions={<MonthNav basePath="/clients" month={month} thisMonth={thisMonth} />} />

      {clients.length === 0 ? (
        <EmptyState title="No clients yet" body="Run the seed file from the Excel workbook, or add a client below." />
      ) : (
        <div className="panel mb-8 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th className="w-[26%]">Completed this month</th>
                <th className="r">Overdue</th>
                <th className="r">Estimated</th>
                <th className="r">Logged</th>
                <th className="r">Recurring tasks</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id} className={c.status !== "active" ? "opacity-60" : undefined}>
                    <td className="whitespace-nowrap">
                      <Link href={`/clients/${c.id}?month=${month}`} className="font-medium hover:underline">{c.name}</Link>
                      {c.status !== "active" ? <span className="ml-2 text-xs text-fog">{c.status === "paused" ? "Paused" : "Archived"}</span> : null}
                    </td>
                    <td>
                      {s ? (
                        <div className="flex items-center gap-3">
                          <ProgressLine value={s.done} total={s.total} tone="green" />
                          <span className="num w-14 shrink-0 text-right text-xs text-graphite">{s.done} / {s.total}</span>
                        </div>
                      ) : (
                        <span className="text-fog">Nothing scheduled</span>
                      )}
                    </td>
                    <td className={`r ${s?.overdue ? "font-medium text-brick" : "text-fog"}`}>{s?.overdue ?? 0}</td>
                    <td className="r">{hours(s?.est ?? 0)}</td>
                    <td className="r">{hours(s?.actual ?? 0)}</td>
                    <td className="r">{templateCount.get(c.id) ?? 0}</td>
                    <td className="text-graphite">{s ? [...s.staff].join(", ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {manager ? (
        <section className="max-w-xl">
          <h2 className="t-section mb-3">Add a client</h2>
          <ActionForm action={saveClient} resetOnSuccess className="panel grid gap-4 p-5 sm:grid-cols-2">
            <label className="field">
              <span className="label">Name</span>
              <input className="input" name="name" required placeholder="For example: Saint Eyewear" />
            </label>
            <label className="field">
              <span className="label">Accounting software</span>
              <input className="input" name="accounting_software" placeholder="Xero, QuickBooks Online…" />
            </label>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton>Add client</SubmitButton>
            </div>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
