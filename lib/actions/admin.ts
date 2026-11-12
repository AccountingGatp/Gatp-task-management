"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireManager } from "@/lib/auth";
import { addDays, isISODate, todayISO } from "@/lib/dates";
import { errorMessage } from "@/lib/format";
import type { ActionState, Frequency } from "@/lib/types";

const done = (message: string): ActionState => ({ ok: true, message });
const fail = (message: string): ActionState => ({ ok: false, message });

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Team ────────────────────────────────────────────────────

export async function saveEmployee(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, me } = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "full_name");
  const role = str(fd, "role") ?? "employee";
  const capacity = num(fd, "weekly_capacity_hours") ?? 40;
  const active = fd.get("active") === "on";
  const email = str(fd, "email")?.toLowerCase() ?? null;
  if (!name) return fail("Enter a name");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address");
  if (id === me.id && (role !== "admin" || !active)) return fail("You can't remove your own admin access. Ask another admin.");

  try {
    let employeeId = id;
    if (id) {
      const { error } = await supabase
        .from("employees")
        .update({ full_name: name, role, weekly_capacity_hours: capacity, active })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("employees")
        .insert({ full_name: name, role, weekly_capacity_hours: capacity, active: true })
        .select("id")
        .single();
      if (error) throw error;
      employeeId = data.id;
    }
    const { error: emailErr } = await supabase.rpc("set_employee_email", { p_employee: employeeId, p_email: email ?? "" });
    if (emailErr) throw emailErr;

    const clientIds = fd.getAll("client_ids").map(String).filter(Boolean);
    if (fd.has("client_access")) {
      await supabase.from("employee_clients").delete().eq("employee_id", employeeId!);
      if (clientIds.length) {
        const { error } = await supabase.from("employee_clients").insert(clientIds.map((c) => ({ employee_id: employeeId, client_id: c })));
        if (error) throw error;
      }
    }
    revalidatePath("/", "layout");
    return done(id ? `Saved ${name}` : `Added ${name}. They can sign in with ${email ?? "the email you add"}.`);
  } catch (e) {
    const msg = errorMessage(e);
    if (msg.includes("employees_full_name_key")) return fail("Someone on the team already has that name");
    return fail(msg);
  }
}

export async function approvePending(id: string, approve: boolean): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { error } = approve
    ? await supabase.from("employees").update({ active: true }).eq("id", id)
    : await supabase.from("employees").delete().eq("id", id);
  if (error) return fail(errorMessage(error));
  revalidatePath("/", "layout");
  return done(approve ? "Access granted" : "Request removed");
}

// ── Clients ─────────────────────────────────────────────────

export async function saveClient(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireManager();
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return fail("Enter the client name");
  const row = {
    name,
    code: str(fd, "code"),
    status: str(fd, "status") ?? "active",
    accounting_software: str(fd, "accounting_software"),
    notes: str(fd, "notes"),
  };
  const { error } = id ? await supabase.from("clients").update(row).eq("id", id) : await supabase.from("clients").insert(row);
  if (error) {
    if ((error as { code?: string }).code === "23505") return fail("A client with that name already exists");
    return fail(errorMessage(error));
  }
  revalidatePath("/", "layout");
  return done(id ? "Client saved" : `Added ${name}`);
}

// ── Task master ─────────────────────────────────────────────

export async function saveTemplate(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, me } = await requireManager();
  const id = str(fd, "id");
  const title = str(fd, "title");
  const clientId = str(fd, "client_id");
  const frequency = (str(fd, "frequency") ?? "weekly") as Frequency;
  const start = str(fd, "start_date") ?? todayISO();
  if (!clientId) return fail("Choose a client");
  if (!title) return fail("Give the task a name");
  if (!isISODate(start)) return fail("Choose a valid start date");

  const row = {
    client_id: clientId,
    title,
    category: str(fd, "category"),
    description: str(fd, "description"),
    frequency,
    weekday: frequency === "weekly" || frequency === "biweekly" ? num(fd, "weekday") ?? 1 : null,
    day_of_month: ["monthly", "quarterly", "yearly"].includes(frequency) ? num(fd, "day_of_month") ?? 1 : null,
    start_date: start,
    end_date: str(fd, "end_date"),
    estimated_hours: num(fd, "estimated_hours"),
    download_hours: num(fd, "download_hours"),
    execution_hours: num(fd, "execution_hours"),
    review_hours: num(fd, "review_hours"),
    default_assignee_id: str(fd, "default_assignee_id"),
    default_reviewer_id: str(fd, "default_reviewer_id"),
    automation_url: str(fd, "automation_url"),
    automation_note: str(fd, "automation_note"),
    sop_type: str(fd, "sop_type"),
    sop_url: str(fd, "sop_url"),
    checking_built_in: str(fd, "checking_built_in"),
    active: fd.get("active") === "on",
    needs_review: fd.get("needs_review") === "on",
  };

  let templateId = id;
  if (id) {
    const { error } = await supabase.from("task_templates").update(row).eq("id", id);
    if (error) return fail(errorMessage(error));
  } else {
    const { data, error } = await supabase.from("task_templates").insert({ ...row, created_by: me.id }).select("id").single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return fail("This client already has a task with that name");
      return fail(errorMessage(error));
    }
    templateId = data.id;
  }

  // Future occurrences nobody has started yet follow the new settings. Past and started work is never touched.
  const today = todayISO();
  const { data: future } = await supabase
    .from("task_assignments")
    .select("id, time_entries(id)")
    .eq("template_id", templateId!)
    .eq("status", "assigned")
    .gte("due_date", today);
  const untouched = (future ?? []).filter((a: { time_entries: unknown[] }) => a.time_entries.length === 0).map((a: { id: string }) => a.id);
  if (untouched.length) await supabase.from("task_assignments").delete().in("id", untouched);
  let created = 0;
  if (row.active) {
    const { data } = await supabase.rpc("generate_recurring_assignments", { p_from: today, p_to: addDays(today, 14) });
    created = (data as number) ?? 0;
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/templates/${templateId}?saved=1`);
  return done(`Saved. ${created} upcoming ${created === 1 ? "occurrence" : "occurrences"} scheduled.`);
}

export async function generateSchedule(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireManager();
  const days = Math.min(60, Math.max(1, num(fd, "days") ?? 14));
  const today = todayISO();
  const { data, error } = await supabase.rpc("generate_recurring_assignments", { p_from: today, p_to: addDays(today, days) });
  if (error) return fail(errorMessage(error));
  revalidatePath("/", "layout");
  const n = (data as number) ?? 0;
  return done(n === 0 ? `The next ${days} days are already scheduled.` : `Added ${n} tasks for the next ${days} days.`);
}

// ── Automation plan ─────────────────────────────────────────

export async function savePlan(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireManager();
  const id = str(fd, "id");
  const clientId = str(fd, "client_id");
  const task = str(fd, "task_title");
  if (!id && (!clientId || !task)) return fail("Choose a client and enter the task");
  const target = str(fd, "target_date");
  if (target && !isISODate(target)) return fail("Choose a valid target date");
  const row: Record<string, unknown> = {
    owner_id: str(fd, "owner_id"),
    target_date: target,
    status: str(fd, "status") ?? "Not started",
  };
  if (!id || fd.has("task_title")) {
    Object.assign(row, {
      client_id: clientId,
      task_title: task,
      existing_automation: str(fd, "existing_automation"),
      checkpoint: str(fd, "checkpoint"),
    });
  }
  const { error } = id ? await supabase.from("automation_plans").update(row).eq("id", id) : await supabase.from("automation_plans").insert(row);
  if (error) return fail(errorMessage(error));
  revalidatePath("/automation");
  return done(id ? "Saved" : "Added to the plan");
}
