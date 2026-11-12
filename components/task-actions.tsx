"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Clock, Check, RotateCcw, ExternalLink, BookOpen, Undo2, SkipForward } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { logTime, startTimer, stopTimer, transitionTask } from "@/lib/actions/tasks";
import type { ActionState, Status } from "@/lib/types";

export type TaskLite = {
  id: string;
  title: string;
  status: Status;
  assignee_id: string | null;
  reviewer_id: string | null;
  automation_url: string | null;
  sop_url: string | null;
};

export type Running = { id: string; assignment_id: string; started_at: string } | null;

function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return "";
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function TaskActions({ task, meId, isManager, running, size = "sm", showLinks = true }: { task: TaskLite; meId: string; isManager: boolean; running: Running; size?: "sm" | "md"; showLinks?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [logOpen, setLogOpen] = useState(false);
  const [reworkOpen, setReworkOpen] = useState(false);
  const mine = task.assignee_id === meId;
  const canReview = (task.reviewer_id === meId || isManager) && (task.status === "submitted" || task.status === "under_review");
  const workable = mine && ["assigned", "in_progress", "rework"].includes(task.status);
  const timingThis = running?.assignment_id === task.id;
  const elapsed = useElapsed(timingThis ? running!.started_at : null);
  const btn = size === "sm" ? "btn btn-sm" : "btn";

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const res = await fn();
      if (res) toast(res.ok, res.message);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {showLinks && task.automation_url ? (
        <a
          href={task.automation_url}
          target="_blank"
          rel="noreferrer"
          className={size === "sm" ? `${btn} btn-ghost btn-icon` : `${btn} btn-ghost`}
          title="Open the automation tool for this task"
          aria-label="Open automation"
        >
          <ExternalLink size={14} />
          {size === "md" ? "Automation" : null}
        </a>
      ) : null}
      {showLinks && task.sop_url ? (
        <a
          href={task.sop_url}
          target="_blank"
          rel="noreferrer"
          className={size === "sm" ? `${btn} btn-ghost btn-icon` : `${btn} btn-ghost`}
          title="Open the instructions (SOP)"
          aria-label="Open SOP"
        >
          <BookOpen size={14} />
          {size === "md" ? "SOP" : null}
        </a>
      ) : null}

      {(workable || (canReview && task.reviewer_id === meId)) &&
        (timingThis ? (
          <button className={`${btn} border-indigo text-indigo`} disabled={pending} onClick={() => run(() => stopTimer(running!.id))} aria-label="Stop timer" title="Stop the clock and save the time">
            <Square size={12} fill="currentColor" />
            <span className="num" suppressHydrationWarning>{elapsed}</span>
          </button>
        ) : (
          <button className={btn} disabled={pending} onClick={() => run(() => startTimer(task.id))} title={running ? "Starts the clock here and stops your other timer" : "Start the clock when you begin working"}>
            <Play size={13} />
            Start
          </button>
        ))}

      {(workable || mine || canReview) && task.status !== "completed" && task.status !== "skipped" ? (
        <button className={btn} disabled={pending} onClick={() => setLogOpen(true)}>
          <Clock size={14} />
          Log time
        </button>
      ) : null}

      {workable ? (
        <button
          className={`${btn} btn-primary`}
          disabled={pending}
          onClick={() => run(() => transitionTask(task.id, "submitted"))}
          title={task.reviewer_id && task.reviewer_id !== task.assignee_id ? "Finished. Send it to the reviewer to check." : "Finished. Mark it completed."}
        >
          <Check size={14} />
          Done
        </button>
      ) : null}

      {mine && task.status === "submitted" && !canReview ? (
        <button className={btn} disabled={pending} onClick={() => run(() => transitionTask(task.id, "in_progress"))} title="Take it back to keep working">
          <Undo2 size={14} />
          Undo done
        </button>
      ) : null}

      {canReview ? (
        <>
          <button className={btn} disabled={pending} onClick={() => setReworkOpen(true)}>
            <RotateCcw size={14} />
            Send back
          </button>
          <button className={`${btn} btn-primary`} disabled={pending} onClick={() => run(() => transitionTask(task.id, "completed"))}>
            <Check size={14} />
            Approve
          </button>
        </>
      ) : null}

      {isManager && size === "md" && task.status === "completed" ? (
        <button className={btn} disabled={pending} onClick={() => run(() => transitionTask(task.id, "in_progress", "Reopened"))}>
          <Undo2 size={14} />
          Reopen
        </button>
      ) : null}
      {isManager && size === "md" && !["completed", "skipped"].includes(task.status) ? (
        <button className={`${btn} btn-ghost`} disabled={pending} onClick={() => run(() => transitionTask(task.id, "skipped", "Skipped by manager"))} title="Skip this occurrence. It won't count in reports.">
          <SkipForward size={14} />
          Skip
        </button>
      ) : null}

      <LogTimeDialog open={logOpen} onClose={() => setLogOpen(false)} taskId={task.id} taskTitle={task.title} defaultKind={mine ? "manual" : "review"} />
      <ReworkDialog open={reworkOpen} onClose={() => setReworkOpen(false)} taskId={task.id} taskTitle={task.title} />
    </div>
  );
}

function LogTimeDialog({ open, onClose, taskId, taskTitle, defaultKind }: { open: boolean; onClose: () => void; taskId: string; taskTitle: string; defaultKind: string }) {
  const toast = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState(logTime, null);
  const today = new Date().toLocaleDateString("en-CA");
  useEffect(() => {
    if (state?.ok) {
      toast(true, state.message);
      onClose();
      router.refresh();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onClose={onClose} title="Log time" description={taskTitle}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="assignment_id" value={taskId} />
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span className="label">Hours</span>
            <input className="input num" name="hours" type="number" min="0" max="16" step="1" inputMode="numeric" placeholder="0" autoFocus />
          </label>
          <label className="field">
            <span className="label">Minutes</span>
            <input className="input num" name="minutes" type="number" min="0" max="59" step="5" inputMode="numeric" placeholder="0" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span className="label">What kind of work</span>
            <select className="select" name="kind" defaultValue={defaultKind}>
              <option value="manual">Doing the task</option>
              <option value="automation">Running the automation</option>
              <option value="review">Checking someone's work</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Date</span>
            <input className="input" name="work_date" type="date" defaultValue={today} max={today} />
          </label>
        </div>
        <label className="field">
          <span className="label">Note</span>
          <input className="input" name="note" placeholder="Optional, for example: waited on client statements" />
        </label>
        {state && !state.ok ? <p className="text-[0.8125rem] text-brick">{state.message}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Log time"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ReworkDialog({ open, onClose, taskId, taskTitle }: { open: boolean; onClose: () => void; taskId: string; taskTitle: string }) {
  const toast = useToast();
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onClose={onClose} title="Send back with a note" description={taskTitle}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await transitionTask(taskId, "rework", comment);
            if (res?.ok) {
              toast(true, res.message);
              setComment("");
              onClose();
              router.refresh();
            } else setError(res?.message ?? "Couldn't send it back");
          });
        }}
      >
        <label className="field">
          <span className="label">What should they fix?</span>
          <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="For example: Chase balance doesn't tie to the statement — check 14 Nov deposits" autoFocus required />
          <span className="hint">The assignee sees this note on the task.</span>
        </label>
        {error ? <p className="text-[0.8125rem] text-brick">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={pending || !comment.trim()}>
            Send back
          </button>
        </div>
      </form>
    </Dialog>
  );
}
