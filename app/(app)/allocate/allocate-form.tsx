"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createAllocation } from "@/lib/actions/tasks";
import { useToast } from "@/components/toast";
import { CapacityBar } from "@/components/capacity-bar";
import { FREQUENCY_LABEL, WEEKDAYS, hours } from "@/lib/format";
import { addDays, startOfWeek, weekLabel, weekdayISO } from "@/lib/dates";
import type { Frequency } from "@/lib/types";

export type TemplateOption = {
  id: string;
  client_id: string;
  title: string;
  category: string | null;
  estimated_hours: number | null;
  default_assignee_id: string | null;
  default_reviewer_id: string | null;
  automation_url: string | null;
  sop_url: string | null;
  frequency: Frequency;
  weekday: number | null;
  day_of_month: number | null;
};

type Person = { id: string; full_name: string; capacity: number };

const NEW_TASK = "__new";
const HOUR_PICKS = [0.5, 1, 2, 4, 8];
const PER_WEEK: Record<Frequency, number> = { daily: 5, weekly: 1, biweekly: 1, monthly: 1, quarterly: 1, yearly: 1, one_time: 1, as_needed: 1 };

/**
 * The whole job in five choices: client, task, person, hours, due date.
 * Everything else (reviewer, repeating, priority, links) sits under "More options".
 */
export function AllocateForm({
  clients,
  people,
  templates,
  load,
  today,
  initialClient,
}: {
  clients: { id: string; name: string }[];
  people: Person[];
  templates: TemplateOption[];
  load: Record<string, Record<string, number>>; // person → week start → hours already planned
  today: string;
  initialClient?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState(createAllocation, null);

  const [clientId, setClientId] = useState(initialClient ?? "");
  const [taskChoice, setTaskChoice] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [est, setEst] = useState("");
  const [due, setDue] = useState(today);
  const [frequency, setFrequency] = useState<Frequency>("one_time");
  const [weekday, setWeekday] = useState(1);
  const [dom, setDom] = useState(5);
  const [category, setCategory] = useState("");
  const [automationUrl, setAutomationUrl] = useState("");
  const [sopUrl, setSopUrl] = useState("");
  const [resetKey, setResetKey] = useState(0);

  const clientTasks = useMemo(() => templates.filter((t) => t.client_id === clientId), [templates, clientId]);
  const tpl = templates.find((t) => t.id === taskChoice);
  const isNew = taskChoice === NEW_TASK || (clientId !== "" && clientTasks.length === 0);
  const title = tpl ? tpl.title : newTitle;

  useEffect(() => {
    if (!state) return;
    toast(state.ok, state.message);
    if (state.ok) {
      // Keep client and person so several tasks can be assigned in a row
      setTaskChoice("");
      setNewTitle("");
      setEst("");
      setFrequency("one_time");
      setResetKey((k) => k + 1);
      router.refresh();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearTaskDetails() {
    setReviewer("");
    setCategory("");
    setAutomationUrl("");
    setSopUrl("");
    setEst("");
    setFrequency("one_time");
  }

  function chooseTask(id: string) {
    setTaskChoice(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setEst(t.estimated_hours != null ? String(t.estimated_hours) : "");
    if (t.default_assignee_id) setAssignee(t.default_assignee_id);
    setReviewer(t.default_reviewer_id ?? "");
    setCategory(t.category ?? "");
    setAutomationUrl(t.automation_url ?? "");
    setSopUrl(t.sop_url ?? "");
    if (t.weekday) setWeekday(t.weekday);
    if (t.day_of_month) setDom(t.day_of_month);
    setFrequency("one_time");
  }

  // For weekly schedules the first due date lands on the chosen weekday
  useEffect(() => {
    if ((frequency === "weekly" || frequency === "biweekly") && due && weekdayISO(due) !== weekday) {
      let iso = addDays(startOfWeek(due), weekday - 1);
      if (iso < today) iso = addDays(iso, 7);
      setDue(iso);
    }
  }, [weekday, frequency]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextMonday = addDays(startOfWeek(today), 7);
  const datePicks = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next Monday", value: nextMonday },
  ];

  const weekStart = startOfWeek(due || today);
  const person = people.find((p) => p.id === assignee);
  const already = person ? load[person.id]?.[weekStart] ?? 0 : 0;
  const adding = (Number(est) || 0) * PER_WEEK[frequency];
  const total = already + adding;
  const over = person ? total - person.capacity : 0;
  const recurring = !["one_time", "as_needed"].includes(frequency);
  const reviewerName = people.find((p) => p.id === reviewer)?.full_name;
  const moreSummary = [reviewerName ? `Checked by ${reviewerName}` : "No checker", recurring ? FREQUENCY_LABEL[frequency] : "One time"].join(", ");
  const ready = clientId && title.trim() && est !== "" && due;

  return (
    <form action={action} className="panel" key={resetKey}>
      <input type="hidden" name="template_id" value={tpl?.id ?? ""} />
      {tpl ? <input type="hidden" name="title" value={tpl.title} /> : null}

      <div className="flex flex-col gap-5 p-5">
        {/* 1. Client */}
        <label className="field">
          <span className="label">Client</span>
          <select
            className="select h-10 text-[0.875rem]"
            name="client_id"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setTaskChoice("");
              setNewTitle("");
              clearTaskDetails();
            }}
            required
          >
            <option value="" disabled>
              Choose a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {/* 2. Task */}
        <div className="field">
          <label className="label" htmlFor="task-choice">
            Task
          </label>
          {clientId && clientTasks.length > 0 ? (
            <select id="task-choice" className="select h-10 text-[0.875rem]" value={taskChoice} onChange={(e) => {
                if (e.target.value === NEW_TASK) {
                  setTaskChoice(NEW_TASK);
                  clearTaskDetails();
                } else chooseTask(e.target.value);
              }} required>
              <option value="" disabled>
                Choose a task for {clients.find((c) => c.id === clientId)?.name}
              </option>
              {clientTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
              <option value={NEW_TASK}>+ Something else (type it)</option>
            </select>
          ) : (
            <select id="task-choice" className="select h-10 text-[0.875rem]" disabled value="">
              <option value="">{clientId ? "No saved tasks for this client, type one below" : "Choose a client first"}</option>
            </select>
          )}
          {isNew ? (
            <input className="input mt-2 h-10 text-[0.875rem]" name="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What needs doing? For example: Fees preparation" autoFocus required />
          ) : null}
        </div>

        {/* 3. Person */}
        <label className="field">
          <span className="label">Who will do it</span>
          <select className="select h-10 text-[0.875rem]" name="assignee_id" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Decide later</option>
            {people.map((p) => {
              const h = Math.round((load[p.id]?.[weekStart] ?? 0) * 10) / 10;
              return (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {h} of {p.capacity} h booked that week
                </option>
              );
            })}
          </select>
        </label>

        {/* 4. Hours  5. Due date */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="est-hours">
              Hours needed
            </label>
            <input id="est-hours" className="input num h-10 text-[0.875rem]" name="estimated_hours" type="number" step="0.25" min="0" max="200" inputMode="decimal" value={est} onChange={(e) => setEst(e.target.value)} placeholder="0" required />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick hours">
              {HOUR_PICKS.map((h) => (
                <button type="button" key={h} onClick={() => setEst(String(h))} className={clsx("btn btn-sm num", Number(est) === h && est !== "" && "border-ink bg-ink text-paper hover:bg-ink")}>
                  {h} h
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="due-date">
              {recurring ? "First due date" : "Due date"}
            </label>
            <input id="due-date" className="input h-10 text-[0.875rem]" name="due_date" type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
              {datePicks.map((d) => (
                <button type="button" key={d.label} onClick={() => setDue(d.value)} className={clsx("btn btn-sm", due === d.value && "border-ink bg-ink text-paper hover:bg-ink")}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Extras, out of the way */}
        <details className="rounded-md border border-rule-soft bg-canvas/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[0.8125rem] select-none [&::-webkit-details-marker]:hidden">
            <span className="font-medium">More options</span>
            <span className="truncate text-graphite">{moreSummary}</span>
          </summary>
          <div className="grid gap-4 border-t border-rule-soft px-3.5 py-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">Who checks it</span>
              <select className="select" name="reviewer_id" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
                <option value="">Nobody, done means done</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Repeats</span>
              <select className="select" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                {(Object.keys(FREQUENCY_LABEL) as Frequency[])
                  .filter((f) => f !== "as_needed")
                  .map((f) => (
                    <option key={f} value={f}>
                      {f === "one_time" ? "No, just once" : FREQUENCY_LABEL[f]}
                    </option>
                  ))}
              </select>
              {tpl && recurring ? <span className="hint">Saves this as the schedule for {tpl.title}.</span> : null}
            </label>
            {frequency === "weekly" || frequency === "biweekly" ? (
              <label className="field">
                <span className="label">Every</span>
                <select className="select" name="weekday" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {frequency === "monthly" || frequency === "quarterly" || frequency === "yearly" ? (
              <label className="field">
                <span className="label">On day</span>
                <input className="input num" name="day_of_month" type="number" min="1" max="31" value={dom} onChange={(e) => setDom(Number(e.target.value))} />
              </label>
            ) : null}
            <label className="field">
              <span className="label">Priority</span>
              <select className="select" name="priority" defaultValue="normal" disabled={recurring}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Note for them</span>
              <input className="input" name="notes" placeholder="Optional" disabled={recurring} />
            </label>
            <label className="field">
              <span className="label">Category</span>
              <input className="input" name="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Bank, AP, Payroll…" />
            </label>
            <label className="field">
              <span className="label">Automation link</span>
              <input className="input" name="automation_url" type="url" value={automationUrl} onChange={(e) => setAutomationUrl(e.target.value)} placeholder="https://…" />
            </label>
            <label className="field sm:col-span-2">
              <span className="label">SOP or Loom link</span>
              <input className="input" name="sop_url" type="url" value={sopUrl} onChange={(e) => setSopUrl(e.target.value)} placeholder="https://…" />
            </label>
          </div>
        </details>
      </div>

      {/* Live check before saving */}
      <div className={clsx("flex flex-col gap-4 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between", over > 0.05 ? "border-coral/40 bg-coral-soft/60" : "border-rule")}>
        <div className="min-w-0 flex-1 text-[0.8125rem]" aria-live="polite">
          {person ? (
            <div className="flex max-w-md flex-col gap-2">
              <p>
                <span className="font-medium">{person.full_name}</span> will have{" "}
                <span className={clsx("num font-semibold", over > 0.05 && "text-brick")}>
                  {Math.round(total * 10) / 10} of {person.capacity} hours
                </span>{" "}
                in the week of {weekLabel(weekStart)}.
                {over > 0.05 ? <span className="block font-medium text-brick">That&apos;s {hours(over)} more than their week. Consider someone else.</span> : null}
              </p>
              <CapacityBar assigned={total} logged={already} capacity={person.capacity} compact animate={false} />
            </div>
          ) : (
            <p className="text-graphite">Choose who will do it to see if it fits their week.</p>
          )}
        </div>
        <button className="btn btn-primary h-10 px-5 text-[0.875rem]" disabled={pending || !ready}>
          {pending ? "Assigning…" : recurring ? "Save and schedule" : "Assign task"}
        </button>
      </div>
      {state && !state.ok ? (
        <p className="px-5 pb-4 text-[0.8125rem] text-brick" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
