import type { Metadata } from "next";
import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Help" };

const ROLES = [
  {
    key: "employee",
    name: "Team member",
    sees: "Your own tasks, tasks you check, and the clients you work on.",
    does: "Start the timer, log time, press Done, check work you're the reviewer for.",
  },
  {
    key: "manager",
    name: "Team manager",
    sees: "Every client, every person, every task.",
    does: "Everything a team member does, plus assign tasks, set up recurring tasks, approve work and see reports.",
  },
  {
    key: "admin",
    name: "Admin",
    sees: "Everything.",
    does: "Everything a manager does, plus add people, choose their role and hours per week, and decide which clients they see.",
  },
] as const;

export default async function HelpPage() {
  const { me } = await requireEmployee();
  const isMgr = me.role !== "employee";
  return (
    <>
      <PageHeader title="How it works" subtitle="Everything you need to know fits on this page." />

      <div className="grid gap-x-10 lg:grid-cols-2">
        <Section title="Doing your tasks">
          <ol className="panel divide-y divide-rule-soft text-[0.8125rem]">
            {[
              ["Open My tasks", "Everything due today is at the top. Anything sent back to you is above that, with the note."],
              ["Press Start when you begin", "The clock runs while you work. Press it again to stop. Only one clock runs at a time."],
              ["Forgot the clock? Press Log time", "Type the hours and minutes afterwards. Both ways count the same."],
              ["Press Done when you finish", "If someone checks this task, it goes to them. If not, it's completed."],
              ["If it comes back", "It appears under Needs changes with the reviewer's note. Fix it and press Done again."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3 px-4 py-3">
                <span className="num mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[0.6875rem] font-semibold text-paper">{i + 1}</span>
                <span>
                  <span className="font-medium">{t}</span>
                  <span className="block text-graphite">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        {isMgr ? (
          <Section title="Giving out work">
            <ol className="panel divide-y divide-rule-soft text-[0.8125rem]">
              {[
                ["Open Assign task", "Choose the client, then the task from the dropdown."],
                ["Choose who will do it", "Each name shows how many hours they already have that week."],
                ["Enter the hours and the due date", "Use the quick buttons: 1 h, 2 h, Today, Tomorrow."],
                ["Check the line at the bottom", "It turns red if the person would go over their week. Pick someone else or another date."],
                ["Press Assign task", "It appears in their My tasks straight away."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3 px-4 py-3">
                  <span className="num mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[0.6875rem] font-semibold text-paper">{i + 1}</span>
                  <span>
                    <span className="font-medium">{t}</span>
                    <span className="block text-graphite">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="hint mt-2">
              Work that repeats every week or month lives in <Link href="/templates" className="link">Recurring tasks</Link>. Set it up once and it is added to people&apos;s lists automatically every morning.
            </p>
          </Section>
        ) : null}
      </div>

      <Section title="Who can do what">
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Can see</th>
                <th>Can do</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.key} className={r.key === me.role ? "bg-indigo-soft/40" : undefined}>
                  <td className="font-medium whitespace-nowrap">
                    {r.name}
                    {r.key === me.role ? <span className="ml-2 text-xs font-normal text-indigo">You</span> : null}
                  </td>
                  <td className="text-graphite">{r.sees}</td>
                  <td className="text-graphite">{r.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">Roles are set by an admin on the Team page. The rules are enforced by the database, so hidden data can&apos;t be reached even by changing the web address.</p>
      </Section>

      <Section title="What the colours mean">
        <ul className="panel grid gap-px overflow-hidden bg-rule-soft text-[0.8125rem] sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["bg-rule-soft text-graphite", "To do", "Not started yet"],
            ["bg-indigo-soft text-indigo", "In progress", "Someone is working on it"],
            ["bg-amber-soft text-amber", "Waiting for review", "Done, waiting to be checked"],
            ["bg-coral-soft text-brick", "Needs changes", "Sent back with a note"],
            ["bg-green-soft text-green", "Completed", "Finished and approved"],
            ["text-brick font-medium", "Red text", "Late, or more hours than the week allows"],
          ].map(([cls, label, desc]) => (
            <li key={label} className="flex items-center gap-3 bg-paper px-4 py-3">
              <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[0.6875rem] font-medium ${cls}`}>{label}</span>
              <span className="text-graphite">{desc}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
