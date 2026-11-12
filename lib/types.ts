export type Role = "admin" | "manager" | "employee";
export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "one_time" | "as_needed";
export type Status = "assigned" | "in_progress" | "submitted" | "under_review" | "rework" | "completed" | "skipped";
export type Priority = "low" | "normal" | "high" | "urgent";
export type TimeKind = "manual" | "automation" | "review";

export interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
  role: Role;
  weekly_capacity_hours: number;
  active: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  code: string | null;
  status: "active" | "paused" | "archived";
  accounting_software: string | null;
  notes: string | null;
}

export interface Template {
  id: string;
  client_id: string;
  category: string | null;
  title: string;
  description: string | null;
  frequency: Frequency;
  weekday: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  estimated_hours: number | null;
  download_hours: number | null;
  execution_hours: number | null;
  review_hours: number | null;
  default_assignee_id: string | null;
  default_reviewer_id: string | null;
  automation_url: string | null;
  automation_note: string | null;
  automation_target: string | null;
  checking_built_in: string | null;
  sop_type: "document" | "loom" | null;
  sop_url: string | null;
  raw_time_text: string | null;
  needs_review: boolean;
  sort_order: number;
  active: boolean;
}

export interface TimeEntry {
  id: string;
  assignment_id: string;
  employee_id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number;
  kind: TimeKind;
  source: "timer" | "manual";
  note: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  template_id: string | null;
  client_id: string;
  title: string;
  category: string | null;
  description: string | null;
  assignee_id: string | null;
  reviewer_id: string | null;
  due_date: string;
  estimated_hours: number;
  status: Status;
  priority: Priority;
  automation_url: string | null;
  sop_url: string | null;
  notes: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Named = { id: string; full_name: string } | null;

export interface AssignmentRow extends Assignment {
  client: { id: string; name: string } | null;
  assignee: Named;
  reviewer: Named;
  time_entries?: Pick<TimeEntry, "minutes" | "kind" | "started_at" | "ended_at" | "employee_id">[];
}

export interface ActivityRow {
  id: number;
  assignment_id: string | null;
  action: string;
  from_status: Status | null;
  to_status: Status | null;
  details: Record<string, unknown>;
  created_at: string;
  actor: Named;
  assignment: { id: string; title: string; client: { name: string } | null } | null;
}

export type ActionState = { ok: boolean; message: string } | null;
