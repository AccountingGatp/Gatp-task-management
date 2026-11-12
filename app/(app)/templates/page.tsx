import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { fetchAll, getClients } from "@/lib/queries";
import { FREQUENCY_LABEL, hours, scheduleText } from "@/lib/format";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { generateSchedule } from "@/lib/actions/admin";
import type { Frequency, Template } from "@/lib/types";

export const metadata: Metadata = { title: "Recurring tasks" };

type Row = Template & { client: { name: string } | null; assignee: { full_name: string } | null; reviewer: { full_name: string } | null };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ client?: string; view?: string; frequency?: string; q?: string }> }) {
  const { supabase } = await requireManager();
  const sp = await searchParams;
  const view = sp.view ?? "all";
  const [clients, rows] = await Promise.all([
    getClients(supabase, { includeArchived: true }),
    fetchAll<Row>((a, b) =>
      supabase
        .from("task_templates")
        .select("*, client:clients(name), assignee:employees!task_templates_default_assignee_id_fkey(full_name), reviewer:employees!task_templates_default_reviewer_id_fkey(full_name)")
        .order("client_id")
        .order("sort_order")
        .range(a, b),
    ),
  ]);

  const base = rows.filter((r) => (!sp.client || r.client_id === sp.client) && (!sp.frequency || r.frequency === sp.frequency) && (!sp.q || r.title.toLowerCase().includes(sp.q.toLowerCase())));
  const filtered = base.filter((r) => (view === "review" ? r.needs_review && r.active : view === "unowned" ? !r.default_assignee_id && r.active : view === "inactive" ? !r.active : r.active));
  filtered.sort((a, b) => (a.client?.name ?? "").localeCompare(b.client?.name ?? "") || a.sort_order - b.sort_order);
  const qs = (v: string) => `/templates?${new URLSearchParams({ ...(sp.client ? { client: sp.client } : {}), ...(sp.frequency ? { frequency: sp.frequency } : {}), view: v }).toString()}`;
  const weeklyHours = filtered.reduce((s, t) => {
    const per: Record<Frequency, number> = { daily: 5, weekly: 1, biweekly: 0.5, monthly: 12 / 52, quarterly: 4 / 52, yearly: 1 / 52, one_time: 0, as_needed: 0 };
    return s + Number(t.estimated_hours ?? 0) * per[t.frequency];
  }, 0);

  return (
    <>
      <PageHeader
        title="Recurring tasks"
        subtitle="Recurring work for every client. Each occurrence is created as its own task, so past work is never overwritten."
        actions={
          <Link href="/templates/new" className="btn btn-primary">
            <Plus size={14} />
            New recurring task
          </Link>
        }
      />

      <ActionForm action={generateSchedule} className="panel mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="text-[0.8125rem]">
          <p className="font-medium">Create upcoming work</p>
          <p className="text-graphite">This runs every morning automatically. Press Schedule after changing a recurring task to update the calendar now.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select w-auto" name="days" defaultValue="14" aria-label="How far ahead">
            <option value="7">Next 7 days</option>
            <option value="14">Next 14 days</option>
            <option value="31">Next 31 days</option>
            <option value="60">Next 60 days</option>
          </select>
          <SubmitButton pendingText="Scheduling…">Schedule</SubmitButton>
        </div>
      </ActionForm>

      <Tabs
        current={qs(view)}
        items={[
          { href: qs("all"), label: "Active", count: base.filter((r) => r.active).length },
          { href: qs("review"), label: "Hours to confirm", count: base.filter((r) => r.needs_review && r.active).length },
          { href: qs("unowned"), label: "No default owner", count: base.filter((r) => !r.default_assignee_id && r.active).length },
          { href: qs("inactive"), label: "Paused", count: base.filter((r) => !r.active).length },
        ]}
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value={view} />
        <label className="field w-56">
          <span className="label">Client</span>
          <select className="select" name="client" defaultValue={sp.client ?? ""}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field w-44">
          <span className="label">Repeats</span>
          <select className="select" name="frequency" defaultValue={sp.frequency ?? ""}>
            <option value="">Any</option>
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
          </select>
        </label>
        <label className="field w-56">
          <span className="label">Search</span>
          <input className="input" name="q" defaultValue={sp.q} placeholder="Task name" />
        </label>
        <button className="btn">Filter</button>
      </form>

      {view === "review" ? (
        <p className="mb-4 max-w-3xl rounded-md bg-amber-soft px-3.5 py-2.5 text-[0.8125rem] text-amber">
          These hours or frequencies were worked out from free text in the Excel sheet (for example “2–3 hours weekly” or a monthly total). Open each one, confirm the hours per occurrence and the schedule, then untick “Hours need confirming”.
        </p>
      ) : null}

      <p className="t-meta num mb-3">{filtered.length} tasks, about {hours(weeklyHours)} of estimated work per week.</p>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here" body="Try another tab or clear the filters." />
      ) : (
        <div className="panel max-h-[70vh] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Task</th>
                <th>Repeats</th>
                <th className="r">Hours each</th>
                <th>Does it</th>
                <th>Checks it</th>
                <th>Automation</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap text-graphite">{t.client?.name}</td>
                  <td className="max-w-[22rem]">
                    <Link href={`/templates/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                    {t.category ? <span className="ml-2 text-xs text-fog">{t.category}</span> : null}
                  </td>
                  <td className="whitespace-nowrap">{scheduleText(t)}</td>
                  <td className="r whitespace-nowrap">
                    {t.estimated_hours != null ? hours(Number(t.estimated_hours)) : <span className="text-fog">—</span>}
                    {t.needs_review ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber align-middle" title="Hours need confirming" /> : null}
                  </td>
                  <td className="whitespace-nowrap">{t.assignee?.full_name ?? <span className="text-fog">—</span>}</td>
                  <td className="whitespace-nowrap text-graphite">{t.reviewer?.full_name ?? "—"}</td>
                  <td className="max-w-[12rem] truncate">
                    {t.automation_url ? <a href={t.automation_url} target="_blank" rel="noreferrer" className="link">{t.automation_url.replace(/^https?:\/\//, "").split("/")[0]}</a> : <span className="text-graphite">{t.automation_note ?? "—"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
