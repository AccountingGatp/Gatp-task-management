import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getClients, getEmployees } from "@/lib/queries";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { TemplateForm } from "@/components/template-form";

export const metadata: Metadata = { title: "New recurring task" };

export default async function NewTemplatePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { supabase } = await requireManager();
  const sp = await searchParams;
  const [clients, employees] = await Promise.all([getClients(supabase), getEmployees(supabase)]);
  return (
    <>
      <Link href="/templates" className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-graphite hover:text-ink">
        <ChevronLeft size={14} />
        Recurring tasks
      </Link>
      <PageHeader title="New recurring task" subtitle="Set it up once. The schedule creates each occurrence and puts it in the owner's work." />
      <div className="max-w-4xl">
        <TemplateForm clients={clients} people={employees} defaultClient={sp.client} today={todayISO()} />
      </div>
    </>
  );
}
