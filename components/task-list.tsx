import Link from "next/link";
import clsx from "clsx";
import { dueLabel, shortDate } from "@/lib/dates";
import { hours } from "@/lib/format";
import { actualHours } from "@/lib/queries";
import { StatusBadge } from "@/components/ui";
import { TaskActions, type Running } from "@/components/task-actions";
import type { AssignmentRow } from "@/lib/types";

export function TaskList({
  tasks,
  today,
  meId,
  isManager,
  running,
  showAssignee = false,
  note,
}: {
  tasks: AssignmentRow[];
  today: string;
  meId: string;
  isManager: boolean;
  running: Running;
  showAssignee?: boolean;
  note?: (t: AssignmentRow) => string | null | undefined;
}) {
  return (
    <ul className="panel divide-y divide-rule-soft">
      {tasks.map((t) => {
        const due = dueLabel(t.due_date, today);
        const late = due.late && ["assigned", "in_progress", "rework"].includes(t.status);
        const dueText = late ? due.text : due.late ? `Due ${shortDate(t.due_date)}` : `Due ${due.text === "Today" || due.text === "Tomorrow" ? due.text.toLowerCase() : due.text}`;
        const est = Number(t.estimated_hours);
        const actual = actualHours(t);
        const over = actual > Number(t.estimated_hours) && Number(t.estimated_hours) > 0;
        const n = note?.(t);
        return (
          <li key={t.id} className={clsx("grid gap-x-6 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center", running?.assignment_id === t.id && "bg-indigo-soft/50")}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">
                  {t.title}
                </Link>
                <StatusBadge status={t.status} />
                {t.priority === "urgent" || t.priority === "high" ? <span className="text-[0.6875rem] font-medium text-brick">{t.priority === "urgent" ? "Urgent" : "High priority"}</span> : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[0.8125rem] text-graphite">
                <span className="font-medium text-ink/80">{t.client?.name}</span>
                {t.category ? <span>{t.category}</span> : null}
                <span className={clsx("num", late && "font-medium text-brick")}>{dueText}</span>
                <span className="num">
                  <span className={clsx(over && "text-brick")}>{hours(actual)}</span>
                  {est > 0 ? ` of ${hours(est)}` : actual > 0 ? " logged" : ", no estimate"}
                </span>
                {showAssignee ? <span>{t.assignee?.full_name ?? "Unassigned"}</span> : null}
              </div>
              {n ? <p className="mt-1.5 rounded-md bg-coral-soft px-2.5 py-1.5 text-[0.8125rem] text-brick">{n}</p> : null}
            </div>
            <TaskActions
              task={{ id: t.id, title: t.title, status: t.status, assignee_id: t.assignee_id, reviewer_id: t.reviewer_id, automation_url: t.automation_url, sop_url: t.sop_url }}
              meId={meId}
              isManager={isManager}
              running={running}
            />
          </li>
        );
      })}
    </ul>
  );
}
