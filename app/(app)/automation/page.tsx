import type { Metadata } from "next";
import clsx from "clsx";
import { requireEmployee, isManagerRole } from "@/lib/auth";
import { getClients, getEmployees } from "@/lib/queries";
import { daysBetween, shortDate, todayISO } from "@/lib/dates";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { savePlan } from "@/lib/actions/admin";

export const metadata: Metadata = { title: "Automation plan" };

type Plan = {
  id: string;
  client_id: string;
  task_title: string;
  existing_automation: string | null;
  checkpoint: string | null;
  owner_id: string | null;
  target_date: string | null;
  status: string;
  client: { name: string } | null;
  owner: { full_name: string } | null;
};

const STATUSES = ["Not started", "In progress", "Done", "On hold"];

export default async function AutomationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase, me } = await requireEmployee();
  const manager = isManagerRole(me.role);
  const sp = await searchParams;
  const today = todayISO();
  const [{ data }, clients, employees] = await Promise.all([
    supabase.from("automation_plans").select("*, client:clients(name), owner:employees(full_name)").order("target_date", { nullsFirst: false }),
    getClients(supabase),
    getEmployees(supabase),
  ]);
  const all = (data ?? []) as unknown as Plan[];
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  const plans = status ? all.filter((p) => p.status === status) : all.filter((p) => p.status !== "Done");
  const done = all.filter((p) => p.status === "Done").length;

  return (
    <>
      <PageHeader title="Automation plan" subtitle={`Check points to build into existing automations, so tasks stop needing manual checking. ${done} of ${all.length} done.`} />
      <Tabs
        current={status ? `/automation?status=${encodeURIComponent(status)}` : "/automation"}
        items={[
          { href: "/automation", label: "Open", count: all.filter((p) => p.status !== "Done").length },
          ...STATUSES.map((s) => ({ href: `/automation?status=${encodeURIComponent(s)}`, label: s, count: all.filter((p) => p.status === s).length })),
        ]}
      />

      {plans.length === 0 ? (
        <EmptyState title="Nothing in this list" />
      ) : (
        <div className="panel mb-8 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Task</th>
                <th>Check point to build in</th>
                <th>Existing automation</th>
                <th>{manager ? "Owner, target and status" : "Owner"}</th>
                {!manager ? <th>Target</th> : null}
                {!manager ? <th>Status</th> : null}
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const late = p.target_date && p.status !== "Done" && daysBetween(today, p.target_date) < 0;
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-graphite">{p.client?.name}</td>
                    <td className="max-w-[16rem] font-medium">{p.task_title}</td>
                    <td className="max-w-[20rem] text-graphite">{p.checkpoint}</td>
                    <td className="max-w-[12rem] truncate">
                      {p.existing_automation?.startsWith("http") ? (
                        <a href={p.existing_automation} target="_blank" rel="noreferrer" className="link">{p.existing_automation.replace(/^https?:\/\//, "").split("/")[0]}</a>
                      ) : (
                        <span className="text-graphite">{p.existing_automation ?? "—"}</span>
                      )}
                    </td>
                    {manager ? (
                      <td>
                        <ActionForm action={savePlan} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="id" value={p.id} />
                          <select className="select h-7 w-28 text-xs" name="owner_id" defaultValue={p.owner_id ?? ""} aria-label="Owner">
                            <option value="">No owner</option>
                            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                          </select>
                          <input className={clsx("input h-7 w-[8.5rem] text-xs", late && "border-coral text-brick")} type="date" name="target_date" defaultValue={p.target_date ?? ""} aria-label="Target date" />
                          <select className="select h-7 w-28 text-xs" name="status" defaultValue={p.status} aria-label="Status">
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <SubmitButton variant="default" className="btn-sm" pendingText="…">Save</SubmitButton>
                        </ActionForm>
                      </td>
                    ) : (
                      <>
                        <td className="whitespace-nowrap">{p.owner?.full_name ?? "—"}</td>
                        <td className={clsx("num whitespace-nowrap", late && "font-medium text-brick")}>{p.target_date ? shortDate(p.target_date) : "—"}</td>
                        <td className="whitespace-nowrap">{p.status}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {manager ? (
        <section className="max-w-3xl">
          <h2 className="t-section mb-3">Add to the plan</h2>
          <ActionForm action={savePlan} resetOnSuccess className="panel grid gap-4 p-5 sm:grid-cols-2">
            <label className="field">
              <span className="label">Client</span>
              <select className="select" name="client_id" required defaultValue="">
                <option value="" disabled>Choose a client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Task</span>
              <input className="input" name="task_title" required />
            </label>
            <label className="field sm:col-span-2">
              <span className="label">Check point to build in</span>
              <input className="input" name="checkpoint" placeholder="For example: Book balance equals statement balance; unmatched items listed" />
            </label>
            <label className="field">
              <span className="label">Existing automation</span>
              <input className="input" name="existing_automation" placeholder="Link or description" />
            </label>
            <label className="field">
              <span className="label">Owner</span>
              <select className="select" name="owner_id" defaultValue="">
                <option value="">No owner</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Target date</span>
              <input className="input" type="date" name="target_date" />
            </label>
            <div className="flex items-end justify-end">
              <SubmitButton>Add to plan</SubmitButton>
            </div>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
