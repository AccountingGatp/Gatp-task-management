"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEmployee, requireManager } from "@/lib/auth";
import { addDays, isISODate, todayISO } from "@/lib/dates";
import { errorMessage } from "@/lib/format";
import type { ActionState, Frequency, Status } from "@/lib/types";

const done = (message: string): ActionState => ({ ok: true, message });
const fail = (message: string): ActionState => ({ ok: false, message });

function refresh() {
  revalidatePath("/", "layout");
}

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

// ── Workflow ────────────────────────────────────────────────

export async function transitionTask(id: string, to: Status, comment?: string): Promise<ActionState> {
  const { supabase } = await requireEmployee();
  const { data, error } = await supabase.rpc("transition_assignment", { p_id: id, p_to: to, p_comment: comment ?? null });
  if (error) return fail(errorMessage(error));
  refresh();
  const result = (data as Status) ?? to;
  if (to === "submitted") {
    if (result === "completed") return done("Done. Marked as completed.");
    const { data: t } = await supabase.from("task_assignments").select("reviewer:employees!task_assignments_reviewer_id_fkey(full_name)").eq("id", id).single();
    const reviewer = (t as { reviewer: { full_name: string } | null } | null)?.reviewer?.full_name;
    return done(reviewer ? `Done. Sent to ${reviewer} to check.` : "Done. Sent for review.");
  }
  const messages: Partial<Record<Status, string>> = {
    in_progress: "Moved back to in progress",
    under_review: "Review started",
    completed: "Approved",
    rework: "Sent back with your note",
    skipped: "Skipped this one",
    assigned: "Moved back to assigned",
  };
  return done(messages[result] ?? "Updated");
}

// ── Time tracking ───────────────────────────────────────────

export async function startTimer(assignmentId: string): Promise<ActionState> {
  const { supabase, me } = await requireEmployee();
  // Stop any timer already running for me
  const { data: running } = await supabase
    .from("time_entries")
    .select("id, started_at, minutes")
    .eq("employee_id", me.id)
    .eq("source", "timer")
    .is("ended_at", null);
  for (const r of running ?? []) {
    await stopEntry(supabase, r.id, r.started_at, r.minutes);
  }
  const { data: task } = await supabase.from("task_assignments").select("status, assignee_id").eq("id", assignmentId).single();
  const { error } = await supabase.from("time_entries").insert({
    assignment_id: assignmentId,
    employee_id: me.id,
    started_at: new Date().toISOString(),
    work_date: todayISO(),
    source: "timer",
    kind: task && task.assignee_id !== me.id ? "review" : "manual",
  });
  if (error) return fail(errorMessage(error));
  if (task && task.assignee_id === me.id && (task.status === "assigned" || task.status === "rework")) {
    await supabase.rpc("transition_assignment", { p_id: assignmentId, p_to: "in_progress", p_comment: null });
  }
  refresh();
  return done("Timer started");
}

async function stopEntry(supabase: Awaited<ReturnType<typeof requireEmployee>>["supabase"], id: string, startedAt: string | null, minutes: number) {
  const elapsed = startedAt ? Math.max(1, Math.ceil((Date.now() - new Date(startedAt).getTime()) / 60000)) : 0;
  return supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString(), minutes: (minutes ?? 0) + elapsed })
    .eq("id", id);
}

export async function stopTimer(entryId: string): Promise<ActionState> {
  const { supabase, me } = await requireEmployee();
  const { data: entry } = await supabase
    .from("time_entries")
    .select("id, started_at, minutes, ended_at")
    .eq("id", entryId)
    .eq("employee_id", me.id)
    .single();
  if (!entry || entry.ended_at) return fail("This timer has already stopped");
  const { error } = await stopEntry(supabase, entry.id, entry.started_at, entry.minutes);
  if (error) return fail(errorMessage(error));
  refresh();
  return done("Time saved");
}

export async function logTime(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, me } = await requireEmployee();
  const assignmentId = str(fd, "assignment_id");
  const h = num(fd, "hours") ?? 0;
  const m = num(fd, "minutes") ?? 0;
  const total = Math.round(h * 60 + m);
  const workDate = str(fd, "work_date") ?? todayISO();
  if (!assignmentId) return fail("Pick a task");
  if (total <= 0) return fail("Enter the time you spent, for example 1 h 30 min");
  if (total > 16 * 60) return fail("One entry can't be more than 16 hours. Split it across days.");
  if (!isISODate(workDate)) return fail("Pick a valid date");
  const kind = str(fd, "kind") ?? "manual";
  const { error } = await supabase.from("time_entries").insert({
    assignment_id: assignmentId,
    employee_id: me.id,
    minutes: total,
    kind,
    work_date: workDate,
    note: str(fd, "note"),
    source: "manual",
  });
  if (error) return fail(errorMessage(error));
  const { data: task } = await supabase.from("task_assignments").select("status, assignee_id").eq("id", assignmentId).single();
  if (task && task.assignee_id === me.id && task.status === "assigned") {
    await supabase.rpc("transition_assignment", { p_id: assignmentId, p_to: "in_progress", p_comment: null });
  }
  refresh();
  return done("Time logged");
}

export async function deleteTimeEntry(id: string): Promise<ActionState> {
  const { supabase } = await requireEmployee();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) return fail(errorMessage(error));
  refresh();
  return done("Entry removed");
}

// ── Allocation (managers) ───────────────────────────────────

export async function createAllocation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, me } = await requireManager();
  const clientId = str(fd, "client_id");
  const title = str(fd, "title");
  const frequency = (str(fd, "frequency") ?? "one_time") as Frequency;
  const due = str(fd, "due_date");
  const est = num(fd, "estimated_hours");
  if (!clientId) return fail("Choose a client");
  if (!title) return fail("Give the task a name");
  if (!due || !isISODate(due)) return fail("Choose a due date");
  if (est === null || est < 0 || est > 200) return fail("Enter estimated hours between 0 and 200");

  const common = {
    client_id: clientId,
    title,
    category: str(fd, "category"),
    description: str(fd, "description"),
    automation_url: str(fd, "automation_url"),
    sop_url: str(fd, "sop_url"),
  };
  const assignee = str(fd, "assignee_id");
  const reviewer = str(fd, "reviewer_id");

  try {
    if (frequency === "one_time" || frequency === "as_needed") {
      const { error } = await supabase.from("task_assignments").insert({
        ...common,
        assignee_id: assignee,
        reviewer_id: reviewer,
        due_date: due,
        estimated_hours: est,
        priority: str(fd, "priority") ?? "normal",
        notes: str(fd, "notes"),
        template_id: str(fd, "template_id"),
        created_by: me.id,
      });
      if (error) {
        if ((error as { code?: string }).code === "23505") return fail("This task is already scheduled on that date. Open it from All tasks to change who does it.");
        throw error;
      }
      refresh();
      return done(`Assigned "${title}"`);
    }

    // Recurring: create (or update) the template, then schedule the next two weeks.
    const weekday = num(fd, "weekday");
    const dom = num(fd, "day_of_month");
    const templateFields = {
      ...common,
      frequency,
      weekday: frequency === "weekly" || frequency === "biweekly" ? weekday ?? 1 : null,
      day_of_month: ["monthly", "quarterly", "yearly"].includes(frequency) ? dom ?? 1 : null,
      start_date: due,
      estimated_hours: est,
      default_assignee_id: assignee,
      default_reviewer_id: reviewer,
      needs_review: false,
      active: true,
    };
    const templateId = str(fd, "template_id");
    if (templateId) {
      const { error } = await supabase.from("task_templates").update(templateFields).eq("id", templateId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("task_templates").insert({ ...templateFields, created_by: me.id });
      if (error) {
        if ((error as { code?: string }).code === "23505") return fail("This client already has a recurring task with that name. Edit it under Recurring tasks instead.");
        throw error;
      }
    }
    const from = due < todayISO() ? todayISO() : due;
    const { data: created, error: genErr } = await supabase.rpc("generate_recurring_assignments", { p_from: from, p_to: addDays(from, 14) });
    if (genErr) throw genErr;
    refresh();
    return done(`Recurring task saved. ${created ?? 0} upcoming ${created === 1 ? "occurrence" : "occurrences"} added to the schedule.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function updateAssignment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireManager();
  const id = str(fd, "id");
  const due = str(fd, "due_date");
  const est = num(fd, "estimated_hours");
  if (!id) return fail("Missing task");
  if (!due || !isISODate(due)) return fail("Choose a due date");
  if (est === null || est < 0) return fail("Enter estimated hours");
  const { error } = await supabase
    .from("task_assignments")
    .update({
      title: str(fd, "title") ?? undefined,
      assignee_id: str(fd, "assignee_id"),
      reviewer_id: str(fd, "reviewer_id"),
      due_date: due,
      estimated_hours: est,
      priority: str(fd, "priority") ?? "normal",
      notes: str(fd, "notes"),
      automation_url: str(fd, "automation_url"),
      sop_url: str(fd, "sop_url"),
    })
    .eq("id", id);
  if (error) return fail(errorMessage(error));
  refresh();
  return done("Changes saved");
}

export async function quickAssign(id: string, assigneeId: string | null): Promise<ActionState> {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("task_assignments").update({ assignee_id: assigneeId }).eq("id", id);
  if (error) return fail(errorMessage(error));
  refresh();
  return done("Reassigned");
}

export async function deleteAssignment(id: string): Promise<void> {
  const { supabase } = await requireManager();
  const { data } = await supabase.from("task_assignments").select("template_id").eq("id", id).single();
  if (data?.template_id) {
    // Recurring occurrences are skipped rather than deleted, so the scheduler doesn't recreate them.
    await supabase.rpc("transition_assignment", { p_id: id, p_to: "skipped", p_comment: "Skipped by manager" });
  } else {
    await supabase.from("task_assignments").delete().eq("id", id);
  }
  refresh();
  redirect("/tasks");
}
