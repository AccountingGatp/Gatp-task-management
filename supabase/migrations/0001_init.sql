-- GATP Task Management — database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Then run supabase/seed.sql to load the clients and task master from the Excel workbook.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Types
-- ─────────────────────────────────────────────────────────────
create type public.app_role as enum ('admin', 'manager', 'employee');
create type public.task_frequency as enum ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'one_time', 'as_needed');
create type public.task_status as enum ('assigned', 'in_progress', 'submitted', 'under_review', 'rework', 'completed', 'skipped');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.time_kind as enum ('manual', 'automation', 'review');

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  email text unique check (email = lower(email)),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  role public.app_role not null default 'employee',
  weekly_capacity_hours numeric(5, 2) not null default 40 check (weekly_capacity_hours >= 0),
  active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  accounting_software text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_clients (
  employee_id uuid not null references public.employees (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  primary key (employee_id, client_id)
);

-- A template defines recurring work. Each occurrence is a task_assignment,
-- so editing a template never overwrites past work.
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  category text,
  title text not null,
  description text,
  frequency public.task_frequency not null default 'weekly',
  weekday smallint check (weekday between 1 and 7),          -- ISO: 1 = Monday
  day_of_month smallint check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  estimated_hours numeric(6, 2),                               -- per occurrence
  download_hours numeric(6, 2),
  execution_hours numeric(6, 2),
  review_hours numeric(6, 2),
  default_assignee_id uuid references public.employees (id) on delete set null,
  default_reviewer_id uuid references public.employees (id) on delete set null,
  automation_url text,
  automation_note text,
  automation_target text,
  checking_built_in text,
  sop_type text check (sop_type in ('document', 'loom')),
  sop_url text,
  raw_time_text text,                                          -- original text from the Excel sheet
  needs_review boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, title)
);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.task_templates (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  category text,
  description text,
  assignee_id uuid references public.employees (id) on delete set null,
  reviewer_id uuid references public.employees (id) on delete set null,
  due_date date not null,
  estimated_hours numeric(6, 2) not null default 0 check (estimated_hours >= 0),
  status public.task_status not null default 'assigned',
  priority public.task_priority not null default 'normal',
  automation_url text,
  sop_url text,
  notes text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, due_date)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.task_assignments (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  minutes integer not null default 0 check (minutes >= 0),
  kind public.time_kind not null default 'manual',
  source text not null default 'manual' check (source in ('timer', 'manual')),
  note text,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.task_assignments (id) on delete cascade,
  reviewer_id uuid references public.employees (id) on delete set null,
  decision text not null check (decision in ('approved', 'rework')),
  comment text,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  assignment_id uuid references public.task_assignments (id) on delete cascade,
  actor_id uuid references public.employees (id) on delete set null,
  action text not null,
  from_status public.task_status,
  to_status public.task_status,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.automation_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  task_title text not null,
  existing_automation text,
  checkpoint text,
  owner_id uuid references public.employees (id) on delete set null,
  target_date date,
  status text not null default 'Not started' check (status in ('Not started', 'In progress', 'Done', 'On hold')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, task_title)
);

-- Indexes
create index on public.task_assignments (assignee_id, due_date);
create index on public.task_assignments (reviewer_id, status);
create index on public.task_assignments (client_id, due_date);
create index on public.task_assignments (status, due_date);
create index on public.time_entries (assignment_id);
create index on public.time_entries (employee_id, work_date);
create index on public.activity_logs (assignment_id, created_at desc);
create index on public.activity_logs (created_at desc);
create index on public.task_templates (client_id, sort_order);
-- one running timer per person
create unique index one_running_timer on public.time_entries (employee_id) where source = 'timer' and ended_at is null;

-- ─────────────────────────────────────────────────────────────
-- Helpers (security definer so RLS policies can call them without recursion)
-- ─────────────────────────────────────────────────────────────
create or replace function public.me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.employees where auth_user_id = auth.uid() and active
$$;

create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.employees where auth_user_id = auth.uid() and active
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'manager'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.can_see_client(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_manager()
      or exists (select 1 from public.employee_clients ec where ec.client_id = p_client and ec.employee_id = public.me())
      or exists (select 1 from public.task_assignments a where a.client_id = p_client
                 and (a.assignee_id = public.me() or a.reviewer_id = public.me()))
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger employees_touch before update on public.employees for each row execute function public.touch_updated_at();
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger templates_touch before update on public.task_templates for each row execute function public.touch_updated_at();
create trigger assignments_touch before update on public.task_assignments for each row execute function public.touch_updated_at();
create trigger plans_touch before update on public.automation_plans for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Sign-in: link the signed-in Google/email account to an employee row.
-- Called by the app right after every sign-in.
--   1. If an admin pre-registered this email on the Team page, link to that row.
--   2. If nobody is admin yet, the first person to sign in becomes admin.
--   3. Otherwise a pending (inactive) row is created for an admin to approve.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_my_employee() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_id uuid;
  v_name text;
begin
  if v_uid is null then
    return null;
  end if;
  select lower(email), raw_user_meta_data into v_email, v_meta from auth.users where id = v_uid;

  select id into v_id from public.employees where email = v_email and auth_user_id is null limit 1;
  if v_id is not null then
    delete from public.employees where auth_user_id = v_uid and id <> v_id and active = false;
    update public.employees
       set auth_user_id = v_uid, avatar_url = coalesce(avatar_url, v_meta ->> 'avatar_url')
     where id = v_id;
    return v_id;
  end if;

  select id into v_id from public.employees where auth_user_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  v_name := coalesce(nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', ''), split_part(v_email, '@', 1));
  if exists (select 1 from public.employees where full_name = v_name) then
    v_name := v_name || ' (' || v_email || ')';
  end if;

  if not exists (select 1 from public.employees where role = 'admin' and auth_user_id is not null and active) then
    insert into public.employees (full_name, email, auth_user_id, role, active, avatar_url)
    values (v_name, v_email, v_uid, 'admin', true, v_meta ->> 'avatar_url')
    returning id into v_id;
  else
    insert into public.employees (full_name, email, auth_user_id, role, active, avatar_url)
    values (v_name, v_email, v_uid, 'employee', false, v_meta ->> 'avatar_url')
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- Admin: give an employee row a sign-in email. If that person already signed in
-- and is waiting as a pending row, merge the pending row into this one.
create or replace function public.set_employee_email(p_employee uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_pending record;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change sign-in emails';
  end if;
  if v_email is null then
    update public.employees set email = null where id = p_employee;
    return;
  end if;
  select id, auth_user_id into v_pending from public.employees
   where email = v_email and id <> p_employee and active = false limit 1;
  if v_pending.id is not null then
    delete from public.employees where id = v_pending.id;
    update public.employees set email = v_email, auth_user_id = coalesce(auth_user_id, v_pending.auth_user_id) where id = p_employee;
    return;
  end if;
  if exists (select 1 from public.employees where email = v_email and id <> p_employee) then
    raise exception 'That email already belongs to another team member';
  end if;
  update public.employees set email = v_email where id = p_employee;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Activity history (who assigned, reassigned, submitted, reviewed …)
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_assignment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.me();
  v_comment text := nullif(current_setting('app.comment', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (assignment_id, actor_id, action, to_status, details)
    values (new.id, v_actor, case when new.template_id is not null and v_actor is null then 'scheduled' else 'created' end,
            new.status, jsonb_build_object('assignee_id', new.assignee_id, 'due_date', new.due_date, 'estimated_hours', new.estimated_hours));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.activity_logs (assignment_id, actor_id, action, from_status, to_status, details)
    values (new.id, v_actor, 'status_changed', old.status, new.status,
            case when v_comment is null then '{}'::jsonb else jsonb_build_object('comment', v_comment) end);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activity_logs (assignment_id, actor_id, action, details)
    values (new.id, v_actor, 'reassigned', jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;
  if new.reviewer_id is distinct from old.reviewer_id then
    insert into public.activity_logs (assignment_id, actor_id, action, details)
    values (new.id, v_actor, 'reviewer_changed', jsonb_build_object('from', old.reviewer_id, 'to', new.reviewer_id));
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.activity_logs (assignment_id, actor_id, action, details)
    values (new.id, v_actor, 'rescheduled', jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.estimated_hours is distinct from old.estimated_hours then
    insert into public.activity_logs (assignment_id, actor_id, action, details)
    values (new.id, v_actor, 'estimate_changed', jsonb_build_object('from', old.estimated_hours, 'to', new.estimated_hours));
  end if;
  return new;
end $$;

create trigger assignments_activity after insert or update on public.task_assignments
for each row execute function public.log_assignment_activity();

create or replace function public.log_time_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.source = 'manual' then
    insert into public.activity_logs (assignment_id, actor_id, action, details)
    values (new.assignment_id, new.employee_id, 'time_logged', jsonb_build_object('minutes', new.minutes, 'kind', new.kind));
  elsif tg_op = 'INSERT' and new.source = 'timer' then
    insert into public.activity_logs (assignment_id, actor_id, action) values (new.assignment_id, new.employee_id, 'timer_started');
  elsif tg_op = 'UPDATE' and old.ended_at is null and new.ended_at is not null then
    insert into public.activity_logs (assignment_id, actor_id, action, details)
    values (new.assignment_id, new.employee_id, 'timer_stopped', jsonb_build_object('minutes', new.minutes));
  end if;
  return new;
end $$;

create trigger time_activity after insert or update on public.time_entries
for each row execute function public.log_time_activity();

-- ─────────────────────────────────────────────────────────────
-- Workflow: Assigned → In progress → Submitted → Under review → Completed (or Rework)
-- Tasks without a separate reviewer go straight from Done to Completed.
-- ─────────────────────────────────────────────────────────────
create or replace function public.transition_assignment(p_id uuid, p_to public.task_status, p_comment text default null)
returns public.task_status
language plpgsql security definer set search_path = public as $$
declare
  a public.task_assignments;
  v_me uuid := public.me();
  v_ok boolean := false;
begin
  if v_me is null then
    raise exception 'Sign in to update tasks';
  end if;
  select * into a from public.task_assignments where id = p_id for update;
  if not found then
    raise exception 'Task not found';
  end if;
  if a.status = p_to then
    return a.status;
  end if;

  if public.is_manager() then
    v_ok := true;
  elsif a.assignee_id = v_me and p_to <> 'skipped' and (
        (a.status in ('assigned', 'rework') and p_to in ('in_progress', 'submitted'))
     or (a.status = 'in_progress' and p_to = 'submitted')
     or (a.status = 'submitted' and p_to = 'in_progress')) then
    v_ok := true;
  end if;
  if not v_ok and a.reviewer_id = v_me and a.status in ('submitted', 'under_review')
     and p_to in ('under_review', 'completed', 'rework') then
    v_ok := true;
  end if;
  if not v_ok then
    raise exception 'You can''t move this task from % to %', replace(a.status::text, '_', ' '), replace(p_to::text, '_', ' ');
  end if;
  if p_to = 'rework' and coalesce(trim(p_comment), '') = '' then
    raise exception 'Add a note that says what needs to change';
  end if;
  -- Nobody else checks this task: "Done" completes it straight away
  if p_to = 'submitted' and (a.reviewer_id is null or a.reviewer_id = a.assignee_id) then
    p_to := 'completed';
  end if;

  if p_to in ('submitted', 'completed', 'skipped') then
    update public.time_entries
       set ended_at = now(),
           minutes = minutes + greatest(1, ceil(extract(epoch from (now() - started_at)) / 60))::int
     where assignment_id = p_id and source = 'timer' and ended_at is null;
  end if;

  perform set_config('app.comment', coalesce(p_comment, ''), true);
  update public.task_assignments
     set status = p_to,
         submitted_at = case when p_to = 'submitted' then now() else submitted_at end,
         completed_at = case when p_to = 'completed' then now() else null end
   where id = p_id;

  if p_to in ('completed', 'rework') and a.status in ('submitted', 'under_review') then
    insert into public.reviews (assignment_id, reviewer_id, decision, comment)
    values (p_id, v_me, case when p_to = 'completed' then 'approved' else 'rework' end, nullif(trim(p_comment), ''));
  end if;
  perform set_config('app.comment', '', true);
  return p_to;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Recurring work: create one assignment per occurrence in a date window.
-- Runs daily from the Vercel cron (/api/cron/generate) and from the
-- "Create upcoming work" button. Never duplicates (unique template_id + due_date).
-- ─────────────────────────────────────────────────────────────
create or replace function public.template_occurs_on(t public.task_templates, d date) returns boolean
language sql immutable set search_path = public as $$
  select d >= t.start_date
     and (t.end_date is null or d <= t.end_date)
     and case t.frequency
       when 'daily' then extract(isodow from d) between 1 and 5
       when 'weekly' then extract(isodow from d) = coalesce(t.weekday, 1)
       when 'biweekly' then extract(isodow from d) = coalesce(t.weekday, 1)
                        and ((d - date_trunc('week', t.start_date)::date) / 7) % 2 = 0
       when 'monthly' then d = least(date_trunc('month', d)::date + (coalesce(t.day_of_month, 1) - 1),
                                     (date_trunc('month', d) + interval '1 month - 1 day')::date)
       when 'quarterly' then (extract(month from d)::int - extract(month from t.start_date)::int) % 3 = 0
                        and d = least(date_trunc('month', d)::date + (coalesce(t.day_of_month, 1) - 1),
                                      (date_trunc('month', d) + interval '1 month - 1 day')::date)
       when 'yearly' then extract(month from d) = extract(month from t.start_date)
                        and d = least(date_trunc('month', d)::date + (coalesce(t.day_of_month, 1) - 1),
                                      (date_trunc('month', d) + interval '1 month - 1 day')::date)
       else false
     end
$$;

create or replace function public.generate_recurring_assignments(p_from date, p_to date) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  -- Signed-in callers must be managers. The cron job uses the service role (no auth.uid()).
  if auth.uid() is not null and not public.is_manager() then
    raise exception 'Only managers can create the schedule';
  end if;
  if p_to < p_from or p_to - p_from > 120 then
    raise exception 'Pick a window of up to 120 days';
  end if;

  insert into public.task_assignments
    (template_id, client_id, title, category, description, assignee_id, reviewer_id, due_date,
     estimated_hours, automation_url, sop_url, status)
  select t.id, t.client_id, t.title, t.category, t.description, t.default_assignee_id, t.default_reviewer_id, d::date,
         coalesce(t.estimated_hours, 0), t.automation_url, t.sop_url, 'assigned'
    from public.task_templates t
    join public.clients c on c.id = t.client_id and c.status = 'active'
    cross join generate_series(p_from, p_to, interval '1 day') d
   where t.active
     and t.frequency not in ('one_time', 'as_needed')
     and public.template_occurs_on(t, d::date)
  on conflict (template_id, due_date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Reporting view: hours logged per assignment, by kind
-- ─────────────────────────────────────────────────────────────
create view public.assignment_hours with (security_invoker = true) as
select a.id as assignment_id,
       round(coalesce(sum(t.minutes) filter (where t.kind = 'manual'), 0) / 60.0, 2) as manual_hours,
       round(coalesce(sum(t.minutes) filter (where t.kind = 'automation'), 0) / 60.0, 2) as automation_hours,
       round(coalesce(sum(t.minutes) filter (where t.kind = 'review'), 0) / 60.0, 2) as review_hours,
       round(coalesce(sum(t.minutes), 0) / 60.0, 2) as total_hours
  from public.task_assignments a
  left join public.time_entries t on t.assignment_id = a.id
 group by a.id;

-- ─────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────
alter table public.employees enable row level security;
alter table public.clients enable row level security;
alter table public.employee_clients enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_assignments enable row level security;
alter table public.time_entries enable row level security;
alter table public.reviews enable row level security;
alter table public.activity_logs enable row level security;
alter table public.automation_plans enable row level security;

-- employees
create policy employees_read on public.employees for select to authenticated
  using (public.me() is not null or auth_user_id = auth.uid());
create policy employees_admin_insert on public.employees for insert to authenticated with check (public.is_admin());
create policy employees_admin_update on public.employees for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy employees_admin_delete on public.employees for delete to authenticated using (public.is_admin());

-- clients
create policy clients_read on public.clients for select to authenticated using (public.can_see_client(id));
create policy clients_mgr_insert on public.clients for insert to authenticated with check (public.is_manager());
create policy clients_mgr_update on public.clients for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy clients_admin_delete on public.clients for delete to authenticated using (public.is_admin());

-- employee_clients
create policy ec_read on public.employee_clients for select to authenticated using (public.is_manager() or employee_id = public.me());
create policy ec_mgr_write on public.employee_clients for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- task_templates
create policy templates_read on public.task_templates for select to authenticated
  using (public.is_manager() or public.can_see_client(client_id));
create policy templates_mgr_write on public.task_templates for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- task_assignments (employees change status through transition_assignment())
create policy assignments_read on public.task_assignments for select to authenticated
  using (public.is_manager() or assignee_id = public.me() or reviewer_id = public.me());
create policy assignments_mgr_write on public.task_assignments for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- time_entries
create policy time_read on public.time_entries for select to authenticated
  using (public.is_manager() or employee_id = public.me());
create policy time_insert on public.time_entries for insert to authenticated
  with check (employee_id = public.me() and exists (
    select 1 from public.task_assignments a where a.id = assignment_id
       and (a.assignee_id = public.me() or a.reviewer_id = public.me() or public.is_manager())));
create policy time_update on public.time_entries for update to authenticated
  using (employee_id = public.me() or public.is_admin()) with check (employee_id = public.me() or public.is_admin());
create policy time_delete on public.time_entries for delete to authenticated
  using (employee_id = public.me() or public.is_admin());

-- reviews (written by transition_assignment)
create policy reviews_read on public.reviews for select to authenticated
  using (public.is_manager() or reviewer_id = public.me() or exists (
    select 1 from public.task_assignments a where a.id = assignment_id and a.assignee_id = public.me()));

-- activity (written by triggers)
create policy activity_read on public.activity_logs for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.task_assignments a where a.id = assignment_id
       and (a.assignee_id = public.me() or a.reviewer_id = public.me())));

-- automation plans
create policy plans_read on public.automation_plans for select to authenticated using (public.me() is not null);
create policy plans_mgr_write on public.automation_plans for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ─────────────────────────────────────────────────────────────
-- Grants: signed-in users only; nothing for anonymous visitors
-- ─────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.assignment_hours to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.me(), public.my_role(), public.is_manager(), public.is_admin(),
  public.can_see_client(uuid), public.sync_my_employee(), public.set_employee_email(uuid, text),
  public.transition_assignment(uuid, public.task_status, text),
  public.generate_recurring_assignments(date, date),
  public.template_occurs_on(public.task_templates, date) to authenticated;
grant execute on function public.generate_recurring_assignments(date, date) to service_role;
