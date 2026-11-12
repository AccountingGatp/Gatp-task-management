import { STATUS_LABEL, duration } from "@/lib/format";
import { shortDate } from "@/lib/dates";
import type { ActivityRow, Status } from "@/lib/types";

/** Plain-language sentence for an activity entry, without the actor's name. */
export function describeActivity(a: ActivityRow, names: Map<string, string>): string {
  const d = a.details ?? {};
  const name = (id: unknown) => (typeof id === "string" ? names.get(id) ?? "someone" : "nobody");
  switch (a.action) {
    case "created":
      return d.assignee_id ? `assigned it to ${name(d.assignee_id)}` : "created it";
    case "scheduled":
      return "added it from recurring tasks";
    case "status_changed": {
      const to = a.to_status as Status;
      const verbs: Partial<Record<Status, string>> = {
        in_progress: a.from_status === "completed" ? "reopened it" : a.from_status === "submitted" ? "withdrew it to keep working" : "started work",
        submitted: "submitted it for review",
        under_review: "started the review",
        completed: a.from_status === "submitted" || a.from_status === "under_review" ? "approved it" : "marked it completed",
        rework: "sent it back for rework",
        skipped: "skipped this occurrence",
        assigned: "moved it back to assigned",
      };
      return verbs[to] ?? `changed it to ${STATUS_LABEL[to]}`;
    }
    case "reassigned":
      return d.to ? `reassigned it to ${name(d.to)}` : "unassigned it";
    case "reviewer_changed":
      return d.to ? `made ${name(d.to)} the reviewer` : "removed the reviewer";
    case "rescheduled":
      return typeof d.to === "string" ? `moved the due date to ${shortDate(d.to)}` : "changed the due date";
    case "estimate_changed":
      return `changed the estimate to ${d.to} h`;
    case "time_logged":
      return `logged ${duration(Number(d.minutes ?? 0))}${d.kind === "automation" ? " of automation" : d.kind === "review" ? " of review" : ""}`;
    case "timer_started":
      return "started a timer";
    case "timer_stopped":
      return `stopped the timer at ${duration(Number(d.minutes ?? 0))}`;
    default:
      return a.action.replace(/_/g, " ");
  }
}
