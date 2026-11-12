# GATP Accounting Work

Internal task management and work distribution for the GATP accounting team. It replaces the per-client Excel task lists with one system where managers assign work, people track time and submit it, reviewers approve it, and management sees every client and every person in one place.

**To deploy, follow [DEPLOYMENT.md](./DEPLOYMENT.md).**

## What it does

| Who | Main screens |
|---|---|
| Admin (Ma'am) | **Dashboard**: active clients, tasks this week, completed, overdue, waiting for review, hours; team workload against capacity; client progress; recent activity. **Team**: who can sign in, roles, hours per week, client access. |
| Team manager | **Assign task**: pick a client and task, choose who does it and who checks it, and see their week before committing ("32 h + 10 h = 42 / 40 h, over by 2 h"). **All tasks** with filters, **To review**, **Recurring tasks**, **Reports**. |
| Team member | **My tasks**: needs changes, overdue, today, this week, next week. Start/stop timer or log time afterwards, open the task's automation and SOP, submit for review. |
| Everyone | **Clients**: monthly progress, who worked on it, hours, six-month history, the client's recurring tasks. **Automation plan**: the Plan of Action check points. |

One assignment appears on the assignee's My work, the reviewer's queue and every management view. There is only ever one record.

### Workflow

`To do → In progress → Waiting for review → Completed`, with **Needs changes** (and a required note) when a reviewer sends it back. People only ever press **Start**, **Done**, or (reviewers) **Approve / Send back**. If a task has no separate reviewer, **Done** completes it straight away. Managers can reopen or skip. Every change is written to the task's history.

### Roles

| Role | Sees | Can do |
|---|---|---|
| Team member | Own tasks, tasks they check, their clients | Timer, log time, Done, check work they review |
| Team manager | Every client, person and task | Plus assign tasks, recurring tasks, approvals, reports |
| Admin | Everything | Plus add people, set roles, hours per week and client access |

The menu only shows what each role can use, and the database enforces the same rules (row level security), so hidden data can't be reached by typing a URL.

### Recurring work

A **recurring tasks** row (template) defines the work once: client, schedule (daily Mon–Fri, weekly on a day, every 2 weeks, monthly on a day, quarterly, yearly, or as needed), hours per occurrence, who does it, who checks it, automation link, SOP. A daily job creates each occurrence as its own task 14 days ahead. Editing a template changes only future occurrences nobody has started, so past records never change.

### Time

Both ways, because accounting work moves between QuickBooks, Xero, email and other tools:
- **Start / Stop timer** on a task (one running timer per person; starting another stops the first)
- **Log time** afterwards, with type: manual work, automation run, or review

Reports split hours into manual, automation and review against the estimate.

### Reports

Monthly, by person, by client and by task, with CSV export. "By task" sorts by where estimates are most off.

## Tech

- Next.js 16 (App Router, Server Actions) + Tailwind CSS 4, Inter
- Supabase: Postgres with row level security, Google and email sign-in
- Vercel hosting and Vercel Cron for the daily schedule

Security is enforced in the database, not just the UI: team members can only read their own tasks, tasks they review, and clients they're given; only managers can assign; status changes go through one checked function (`transition_assignment`); anonymous visitors can't read anything.

## Project layout

```
app/
  (app)/overview       Admin / manager dashboard
  (app)/my-work        Employee dashboard
  (app)/allocate       Assign work with live capacity
  (app)/tasks          All tasks + task detail (history, time, edit)
  (app)/reviews        Review queue
  (app)/clients        Client list + client overview
  (app)/templates      Recurring tasks (recurring templates)
  (app)/reports        Monthly reports + CSV
  (app)/automation     Automation plan of action
  (app)/team           People, roles, capacity, access
  api/cron/generate    Daily scheduler (Vercel Cron)
  api/reports/export   CSV export
  login, auth/*        Sign-in
lib/                   Supabase clients, auth, queries, server actions, dates, reports
components/            UI pieces (capacity ruler, task actions, dialogs, collapsible sidebar)
DESIGN.md              Lucide design reference and how the app applies it
supabase/migrations/   Database schema, security rules and functions
supabase/seed.sql      Clients, people, recurring tasks and plan from the Excel workbook
scripts/import_workbook.py   Regenerates seed.sql from an updated workbook
```

## Re-importing an updated Excel workbook

```bash
pip install openpyxl
python3 scripts/import_workbook.py "Client Task List_Automation.xlsx" > supabase/seed.sql
```

Then run `supabase/seed.sql` in the Supabase SQL Editor. Existing clients, people and tasks are kept; new rows are added.
