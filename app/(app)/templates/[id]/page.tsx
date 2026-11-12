import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getClients, getEmployees } from "@/lib/queries";
import { shortDate, todayISO } from "@/lib/dates";
import { hours, scheduleText } from "@/lib/format";
import { PageHeader, Section, StatusBadge } from "@/components/ui";
import { TemplateForm } from "@/components/template-form";
import type { Status, Template } from "@/lib/types";

export const metadata: Metadata = { title: "Recurring task" };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireManager();
  const today = todayISO();
  const [{ data }, clients, employees, occ] = await Promise.all([
    supabase.from("task_templates").select("*, client:clients(name)").eq("id", id).maybeSingle(),
    getClients(supabase, { includeArchived: true }),
    getEmployees(supabase),
    supabase
      .from("task_assignments")
      .select("id, due_date, status, estimated_hours, assignee:employees!task_assignments_assignee_id_fkey(full_name)")
      .eq("template_id", id)
      .order("due_date", { ascending: false })
      .limit(12),
  ]);
  if (!data) notFound();
  const t = data as Template & { client: { name: string } | null };
  const occurrences = (occ.data ?? []) as unknown as { id: string; due_date: string; status: Status; estimated_hours: number; assignee: { full_name: string } | null }[];

  return (
    <>
      <Link href={`/templates?client=${t.client_id}`} className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-graphite hover:text-ink">
        <ChevronLeft size={14} />
        Recurring tasks
      </Link>
      <PageHeader title={t.title} subtitle={`${t.client?.name ?? ""}, ${scheduleText(t).toLowerCase()}${t.estimated_hours != null ? `, ${hours(Number(t.estimated_hours))} each` : ""}`} />
      <div className="grid gap-x-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="Settings">
          <TemplateForm template={t} clients={clients} people={employees} today={today} />
        </Section>
        <Section title="Recent and upcoming">
          {occurrences.length === 0 ? (
            <p className="t-meta">Nothing scheduled yet. Press Schedule on the Recurring tasks page.</p>
          ) : (
            <ul className="panel divide-y divide-rule-soft">
              {occurrences.map((o) => (
                <li key={o.id}>
                  <Link href={`/tasks/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.8125rem] transition-colors hover:bg-canvas">
                    <span className={`num ${o.due_date === today ? "font-semibold" : ""}`}>{shortDate(o.due_date)}</span>
                    <span className="flex-1 truncate text-graphite">{o.assignee?.full_name ?? "Unassigned"}</span>
                    <StatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
