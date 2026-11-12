"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveTemplate } from "@/lib/actions/admin";
import { FREQUENCY_LABEL, WEEKDAYS } from "@/lib/format";
import type { Frequency, Template } from "@/lib/types";

export function TemplateForm({ template, clients, people, defaultClient, today }: { template?: Template; clients: { id: string; name: string }[]; people: { id: string; full_name: string }[]; defaultClient?: string; today: string }) {
  const [frequency, setFrequency] = useState<Frequency>(template?.frequency ?? "weekly");
  const t = template;
  return (
    <ActionForm action={saveTemplate} className="panel">
      {t ? <input type="hidden" name="id" value={t.id} /> : null}
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="field">
          <span className="label">Client</span>
          <select className="select" name="client_id" defaultValue={t?.client_id ?? defaultClient ?? ""} required>
            <option value="" disabled>Choose a client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Category</span>
          <input className="input" name="category" defaultValue={t?.category ?? ""} placeholder="Bank, AP, Payroll, Month end close…" />
        </label>
        <label className="field sm:col-span-2">
          <span className="label">Task</span>
          <input className="input" name="title" defaultValue={t?.title ?? ""} required placeholder="For example: Bank and CC reconciliation" />
        </label>
        <label className="field sm:col-span-2">
          <span className="label">Instructions</span>
          <textarea className="textarea" name="description" defaultValue={t?.description ?? ""} placeholder="What done looks like, where the files are, what to check" />
        </label>

        <label className="field">
          <span className="label">Repeats</span>
          <select className="select" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
          </select>
          {frequency === "as_needed" || frequency === "one_time" ? <span className="hint">Not scheduled automatically. Assign it from Assign task when it comes up.</span> : null}
        </label>
        {frequency === "weekly" || frequency === "biweekly" ? (
          <label className="field">
            <span className="label">On</span>
            <select className="select" name="weekday" defaultValue={t?.weekday ?? 1}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select>
          </label>
        ) : ["monthly", "quarterly", "yearly"].includes(frequency) ? (
          <label className="field">
            <span className="label">Day of the month</span>
            <input className="input num" type="number" min="1" max="31" name="day_of_month" defaultValue={t?.day_of_month ?? 5} />
            <span className="hint">{frequency === "quarterly" ? "Every third month, counted from the start date." : frequency === "yearly" ? "In the start date's month." : "Days past month-end move to the last day."}</span>
          </label>
        ) : (
          <div />
        )}
        <label className="field">
          <span className="label">Starts</span>
          <input className="input" type="date" name="start_date" defaultValue={t?.start_date ?? today} />
          {frequency === "biweekly" ? <span className="hint">Every other week, counted from this week.</span> : null}
        </label>
        <label className="field">
          <span className="label">Ends</span>
          <input className="input" type="date" name="end_date" defaultValue={t?.end_date ?? ""} />
          <span className="hint">Leave empty to keep repeating.</span>
        </label>

        <fieldset className="grid gap-4 border-t border-rule-soft pt-4 sm:col-span-2 sm:grid-cols-4">
          <legend className="sr-only">Hours</legend>
          <label className="field">
            <span className="label">Hours each time</span>
            <input className="input num" type="number" step="0.05" min="0" name="estimated_hours" defaultValue={t?.estimated_hours ?? ""} />
          </label>
          <label className="field">
            <span className="label">Download</span>
            <input className="input num" type="number" step="0.05" min="0" name="download_hours" defaultValue={t?.download_hours ?? ""} />
          </label>
          <label className="field">
            <span className="label">Execution</span>
            <input className="input num" type="number" step="0.05" min="0" name="execution_hours" defaultValue={t?.execution_hours ?? ""} />
          </label>
          <label className="field">
            <span className="label">Review</span>
            <input className="input num" type="number" step="0.05" min="0" name="review_hours" defaultValue={t?.review_hours ?? ""} />
          </label>
          {t?.raw_time_text ? <p className="hint sm:col-span-4">Excel sheet said: “{t.raw_time_text}”</p> : null}
        </fieldset>

        <label className="field">
          <span className="label">Does it</span>
          <select className="select" name="default_assignee_id" defaultValue={t?.default_assignee_id ?? ""}>
            <option value="">Nobody by default</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Checks it</span>
          <select className="select" name="default_reviewer_id" defaultValue={t?.default_reviewer_id ?? ""}>
            <option value="">No reviewer</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="label">Automation link</span>
          <input className="input" type="url" name="automation_url" defaultValue={t?.automation_url ?? ""} placeholder="https://….vercel.app" />
        </label>
        <label className="field">
          <span className="label">Automation status</span>
          <input className="input" name="automation_note" defaultValue={t?.automation_note ?? ""} placeholder="Rules are created, In process, Not started…" />
        </label>
        <label className="field">
          <span className="label">SOP</span>
          <select className="select" name="sop_type" defaultValue={t?.sop_type ?? ""}>
            <option value="">No SOP</option>
            <option value="document">Written SOP</option>
            <option value="loom">Loom video</option>
          </select>
        </label>
        <label className="field">
          <span className="label">SOP link</span>
          <input className="input" type="url" name="sop_url" defaultValue={t?.sop_url ?? ""} placeholder="https://…" />
        </label>
        <label className="field">
          <span className="label">Checking built into automation</span>
          <select className="select" name="checking_built_in" defaultValue={t?.checking_built_in ?? ""}>
            <option value="">Not set</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="To be confirmed">To be confirmed</option>
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2.5 text-[0.8125rem]">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={t?.active ?? true} className="size-4 accent-ink" />
            Active, keep scheduling it
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="needs_review" defaultChecked={t?.needs_review ?? false} className="size-4 accent-ink" />
            Hours need confirming
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-4">
        <p className="hint max-w-md">Saving updates upcoming occurrences nobody has started. Past and in-progress work keeps its original details.</p>
        <SubmitButton>{t ? "Save changes" : "Create recurring task"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
