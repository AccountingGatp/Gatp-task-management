import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getClients, getEmployees } from "@/lib/queries";
import { timeAgo } from "@/lib/dates";
import { Avatar, PageHeader, Section } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { PendingActions } from "@/components/pending-actions";
import { saveEmployee } from "@/lib/actions/admin";
import type { Employee } from "@/lib/types";

export const metadata: Metadata = { title: "Team" };

const ROLE_LABEL = { admin: "Admin", manager: "Team manager", employee: "Team member" } as const;

export default async function TeamPage() {
  const { supabase, me } = await requireAdmin();
  const [employees, clients, accessRes] = await Promise.all([
    getEmployees(supabase, { includeInactive: true }),
    getClients(supabase),
    supabase.from("employee_clients").select("employee_id, client_id"),
  ]);
  const access = new Map<string, Set<string>>();
  for (const a of accessRes.data ?? []) {
    if (!access.has(a.employee_id)) access.set(a.employee_id, new Set());
    access.get(a.employee_id)!.add(a.client_id);
  }
  const pending = employees.filter((e) => !e.active && e.auth_user_id);
  const team = employees.filter((e) => !pending.includes(e));

  return (
    <>
      <PageHeader title="Team" subtitle="Who can sign in, what they can see, and how many hours a week they have." />

      {pending.length ? (
        <Section title="Waiting for access" aside={`${pending.length} signed in but not approved`}>
          <ul className="panel divide-y divide-rule-soft">
            {pending.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={e.full_name} url={e.avatar_url} size={28} />
                  <div>
                    <p className="font-medium">{e.full_name}</p>
                    <p className="t-meta">{e.email}, signed in {timeAgo(e.created_at)}</p>
                  </div>
                </div>
                <PendingActions id={e.id} />
              </li>
            ))}
          </ul>
          <p className="hint mt-2">If this person is already on the team below, add this email to their row instead. Their sign-in is merged automatically.</p>
        </Section>
      ) : null}

      <Section title="Team members" aside={`${team.filter((e) => e.active).length} active`}>
        <ul className="panel divide-y divide-rule-soft">
          {team.map((e) => (
            <li key={e.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas [&::-webkit-details-marker]:hidden">
                  <Avatar name={e.full_name} url={e.avatar_url} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {e.full_name}
                      {!e.active ? <span className="ml-2 text-xs font-normal text-fog">Inactive</span> : null}
                    </p>
                    <p className="t-meta truncate">{e.email ?? "No sign-in email yet"}{e.email && !e.auth_user_id ? ", hasn't signed in yet" : ""}</p>
                  </div>
                  <span className="hidden text-[0.8125rem] text-graphite sm:block">{ROLE_LABEL[e.role]}</span>
                  <span className="num hidden w-16 text-right text-[0.8125rem] text-graphite sm:block">{Number(e.weekly_capacity_hours)} h/wk</span>
                  <span className="text-xs text-fog group-open:hidden">Edit</span>
                  <span className="hidden text-xs text-fog group-open:inline">Close</span>
                </summary>
                <EmployeeForm employee={e} clients={clients} access={access.get(e.id) ?? new Set()} isSelf={e.id === me.id} />
              </details>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Add a team member">
        <div className="panel max-w-3xl">
          <EmployeeForm clients={clients} access={new Set()} />
        </div>
      </Section>
    </>
  );
}

function EmployeeForm({ employee, clients, access, isSelf }: { employee?: Employee; clients: { id: string; name: string }[]; access: Set<string>; isSelf?: boolean }) {
  const e = employee;
  return (
    <ActionForm action={saveEmployee} resetOnSuccess={!e} className="grid gap-4 border-t border-rule-soft bg-canvas/40 p-5 sm:grid-cols-2">
      {e ? <input type="hidden" name="id" value={e.id} /> : null}
      <input type="hidden" name="client_access" value="1" />
      <label className="field">
        <span className="label">Name</span>
        <input className="input" name="full_name" defaultValue={e?.full_name} required />
      </label>
      <label className="field">
        <span className="label">Sign-in email</span>
        <input className="input" type="email" name="email" defaultValue={e?.email ?? ""} placeholder="name@company.com" />
        <span className="hint">They sign in with Google or an email link using this address.</span>
      </label>
      <label className="field">
        <span className="label">Role</span>
        <select className="select" name="role" defaultValue={e?.role ?? "employee"} disabled={isSelf}>
          <option value="employee">Team member: sees own tasks and their clients</option>
          <option value="manager">Team manager: assigns, reviews, sees everyone</option>
          <option value="admin">Admin: everything, plus team and access</option>
        </select>
        {isSelf ? <input type="hidden" name="role" value="admin" /> : null}
      </label>
      <label className="field">
        <span className="label">Hours per week</span>
        <input className="input num" type="number" min="0" max="80" step="0.5" name="weekly_capacity_hours" defaultValue={e ? Number(e.weekly_capacity_hours) : 40} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="label mb-2">Clients they can see</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {clients.map((c) => (
            <label key={c.id} className="inline-flex items-center gap-2 text-[0.8125rem]">
              <input type="checkbox" name="client_ids" value={c.id} defaultChecked={access.has(c.id)} className="size-4 accent-ink" />
              {c.name}
            </label>
          ))}
        </div>
        <p className="hint mt-2">Managers and admins see every client. Team members also see any task assigned to them.</p>
      </fieldset>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        {e ? (
          <label className="inline-flex items-center gap-2 text-[0.8125rem]">
            <input type="checkbox" name="active" defaultChecked={e.active} disabled={isSelf} className="size-4 accent-ink" />
            Active
            {isSelf ? <input type="hidden" name="active" value="on" /> : null}
          </label>
        ) : (
          <span>
            <input type="hidden" name="active" value="on" />
          </span>
        )}
        <SubmitButton>{e ? "Save" : "Add team member"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
