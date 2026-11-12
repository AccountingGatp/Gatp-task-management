#!/usr/bin/env python3
"""
Convert "Client Task List_Automation.xlsx" into supabase/seed.sql.

Usage:
    pip install openpyxl
    python3 scripts/import_workbook.py "Client Task List_Automation.xlsx" > supabase/seed.sql

What it does
- Every client sheet becomes a client + its task templates (the "task master").
- Free-text time ("2-3 hours weekly", "1:30 hr bi-weekly", "20 Min Monthly")
  is standardised into: frequency + estimated hours per occurrence.
- Anything that had to be guessed is marked needs_review = true and the
  original text is kept in raw_time_text, so nothing from the sheet is lost.
- The "Plan of Action" sheet becomes the automation plan tracker.
"""
import re
import sys
from datetime import datetime

import openpyxl

CLIENT_NAMES = {
    "Saint Eyewear": "Saint Eyewear",
    "Empire": "Empire",
    "Bravura": "Bravura",
    "Republic Supply": "Republic Supply",
    "World of Boxes": "World of Boxes",
    "LXP": "LXP",
    "Achieve": "Achieve",
    "Hamliton": "Hamilton",
    "Whisper": "Whisper Snail",
    "CHW": "Clear Water Home",
    "Mystery": "Mystery",
}
EXTRA_CLIENTS = ["PMG", "Bluntd"]  # listed in Sheet1 but without a task sheet

MANAGERS = {"Krupali", "Simran"}

FREQ_WORDS = [
    ("biweekly", r"bi-?\s?weekly|fortnight|per cycle"),
    ("daily", r"per day|daily|every day"),
    ("weekly", r"weekly|per week|a week"),
    ("monthly", r"monthly|per month|a month"),
    ("quarterly", r"quarter"),
    ("yearly", r"yearly|annual|per year"),
    ("as_needed", r"same day when received|as needed|depends"),
]

CATEGORY_FREQ = {
    "bank": "weekly", "ap": "weekly", "ar": "weekly", "ar / ap": "weekly",
    "sales": "weekly", "fees": "weekly", "advertisement": "weekly", "cogs": "weekly",
    "payroll": "biweekly", "reporting": "weekly", "communication": "daily",
    "month end close": "monthly", "tax": "monthly", "intercompany": "monthly",
    "equity": "monthly", "client calls": "weekly", "vendor jes": "monthly",
    "deposits / sales": "weekly", "other": "as_needed",
    "cost invoices & bills": "monthly", "upwork bills & invoices": "monthly",
}
SECTION_FREQ = {
    "daily": "daily", "weekly / bi-weekly": "weekly", "monthly": "monthly",
    "quarterly / as needed": "quarterly", "need to start": "as_needed",
}


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(round(float(v), 2))
    return "'" + str(v).replace("'", "''").strip() + "'"


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def detect_freq(text):
    if not text:
        return None
    t = text.lower()
    for freq, pat in FREQ_WORDS:
        if re.search(pat, t):
            return freq
    return None


def to_hours(num, unit):
    unit = (unit or "h").lower()
    return num / 60.0 if unit.startswith("m") else num


def parse_amount(text):
    """Return hours as float for the first time expression in text, or None."""
    t = text.lower().replace("\n", " ")
    # H:MM
    m = re.search(r"(\d+):(\d{2})\s*(hrs?|hours?)?", t)
    if m:
        return int(m.group(1)) + int(m.group(2)) / 60.0
    # range a-b unit
    m = re.search(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(min|mins|minutes|hrs?|hours?|h\b)?", t)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        return to_hours((a + b) / 2.0, m.group(3))
    m = re.search(r"(\d+(?:\.\d+)?)\s*(min|mins|minutes|hrs?|hours?|h\b)?", t)
    if m:
        return to_hours(float(m.group(1)), m.group(2))
    return None


def parse_time(text):
    """-> (hours_per_occurrence|None, frequency|None, exact: bool)"""
    if not text:
        return None, None, False
    t = str(text).strip()
    tl = t.lower()
    # Prefer a parenthesised "(2 Hours per week)" / "( Monthly 2 Hours)"
    for inner in re.findall(r"\(([^)]*)\)", t):
        f = detect_freq(inner)
        h = parse_amount(inner)
        if f and h is not None:
            return h, f, True
    # "2:00 hr (bank) + 3:30 hr weekly (matching)" -> sum when only one frequency mentioned
    if "+" in t:
        parts = [p for p in t.split("+")]
        freqs = {detect_freq(p) for p in parts if detect_freq(p)}
        hours = [parse_amount(re.sub(r"\([^)]*\)", "", p)) for p in parts]
        if len(freqs) == 1 and all(h is not None for h in hours):
            return sum(hours), freqs.pop(), True
        first = hours[0] if hours else None
        return first, detect_freq(parts[0]), False
    h = parse_amount(re.sub(r"\([^)]*\)", "", t))
    f = detect_freq(tl)
    return h, f, h is not None and f is not None


CATEGORY_KEYWORDS = [
    ("Payroll", r"payroll|pto|time card|tsheet"),
    ("Month end close", r"month clos|month end|t12|bad debt|mortgage"),
    ("Bank", r"bank|ramp|credit card|cc |debit block|aig"),
    ("Sales", r"deposit|merchant|collection"),
    ("Communication", r"mail|calls"),
    ("AP", r"invoice|bill|payment|avid|a/p|capture"),
    ("Reporting", r"report"),
]


def guess_category(title_lower):
    for name, pat in CATEGORY_KEYWORDS:
        if re.search(pat, title_lower):
            return name
    return "Other"


def find_header(ws):
    for r in range(1, 6):
        vals = [clean(c.value) for c in ws[r]]
        if any(v and v.lower().startswith("task list") for v in vals):
            return r, vals
    raise ValueError(f"No header in {ws.title}")


def col(headers, *starts):
    for i, h in enumerate(headers):
        if h and any(h.lower().startswith(s) for s in starts):
            return i
    return None


def parse_date(s):
    if not s:
        return None
    if isinstance(s, datetime):
        return s.date().isoformat()
    for fmt in ("%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(str(s).strip(), fmt).date().isoformat()
        except ValueError:
            pass
    return None


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    templates = []
    people = set()

    for sheet, client in CLIENT_NAMES.items():
        if sheet not in wb.sheetnames:
            continue
        ws = wb[sheet]
        hr, headers = find_header(ws)
        c_title = col(headers, "task list")
        c_freq = col(headers, "frequency")
        c_time = col(headers, "current total time")
        c_dl = col(headers, "download")
        c_ex = col(headers, "execution –", "execution -")
        c_auto = col(headers, "execution\n(automation", "execution (automation")
        c_check = col(headers, "checking")
        c_sop = col(headers, "sop")
        c_who = col(headers, "who is working")
        c_rev = col(headers, "who is checking")
        if c_rev is None and c_who is not None and headers[c_who + 1] is None:
            c_rev = c_who + 1  # unnamed column right after "Who is working on it"
        c_target = col(headers, "target date")
        c_link = col(headers, "automation link")
        time_header = (headers[c_time] or "").lower() if c_time is not None else ""
        sheet_freq = "weekly" if "per week" in time_header else None
        monthly_totals = sheet == "Saint Eyewear"  # sheet records monthly totals per task

        category = None
        section_freq = None
        order = 0
        for row in ws.iter_rows(min_row=hr + 1, values_only=True):
            row = list(row) + [None] * 30
            head = clean(row[0])
            if head:
                hl = head.lower()
                if hl in SECTION_FREQ:
                    section_freq = SECTION_FREQ[hl]
                    category = None
                else:
                    category = head
            title = clean(row[c_title])
            if not title or title.lower().startswith("yellow ="):
                continue
            order += 1
            raw_time = clean(row[c_time]) if c_time is not None else None
            hours, freq, exact = parse_time(raw_time)
            explicit_freq = clean(row[c_freq]) if c_freq is not None else None
            if explicit_freq:
                freq = detect_freq(explicit_freq) or freq
            tl = title.lower()
            # Only trust long-cycle words in titles ("Daily reporting sheet" is a report, not a frequency)
            title_freq = detect_freq(tl) if re.search(r"month|quarter|year|annual|weekly", tl) else None
            if "month end" in tl or "month closure" in tl:
                title_freq = title_freq or "monthly"
            row_category = category or guess_category(tl)
            cat_key = row_category.lower()
            needs_review = not exact
            if not freq:
                freq = (title_freq or section_freq or (sheet_freq if hours is not None else None)
                        or CATEGORY_FREQ.get(cat_key) or "weekly")
                needs_review = True
            if monthly_totals and hours is not None:
                if freq == "weekly" and not (raw_time and "per week" in raw_time.lower()):
                    hours = hours / 4.0
                needs_review = True
            dl = parse_amount(clean(row[c_dl])) if c_dl is not None and clean(row[c_dl]) else None
            ex = parse_amount(clean(row[c_ex])) if c_ex is not None and clean(row[c_ex]) else None
            if hours is None:
                needs_review = True
                hours = (dl or 0) + (ex or 0) or None

            auto = clean(row[c_auto]) if c_auto is not None else None
            link = clean(row[c_link]) if c_link is not None else None
            automation_url = None
            automation_note = None
            for v in (link, auto):
                if v and v.lower().startswith("http") and not automation_url:
                    automation_url = v
                elif v and not v.lower().startswith("http"):
                    automation_note = v
            sop = clean(row[c_sop]) if c_sop is not None else None
            sop_type = None
            if sop:
                sop_type = "loom" if "loom" in sop.lower() else ("document" if sop.lower() == "yes" else None)
            who = clean(row[c_who]) if c_who is not None else None
            rev = clean(row[c_rev]) if c_rev is not None else None
            if rev and rev.lower() in ("yes", "no"):
                rev = None
            for p in (who, rev):
                if p:
                    people.add(p)
            check = clean(row[c_check]) if c_check is not None else None
            target = clean(row[c_target]) if c_target is not None else None

            weekday = None
            dom = None
            if freq in ("weekly", "biweekly"):
                weekday = 5 if cat_key == "reporting" or "status" in tl else 1
            if freq in ("monthly", "quarterly", "yearly"):
                dom = 5

            templates.append(dict(
                client=client, category=row_category, title=title, frequency=freq,
                weekday=weekday, day_of_month=dom,
                estimated_hours=round(hours, 2) if hours else None,
                download_hours=dl, execution_hours=ex,
                assignee=who, reviewer=rev,
                automation_url=automation_url, automation_note=automation_note,
                checking_built_in=check, sop_type=sop_type,
                automation_target=target, raw_time_text=raw_time,
                needs_review=needs_review, sort_order=order,
            ))

    # Plan of action
    plans = []
    if "Plan of Action" in wb.sheetnames:
        ws = wb["Plan of Action"]
        for row in ws.iter_rows(min_row=4, values_only=True):
            client, task, existing, check, person, target, status = (list(row) + [None] * 7)[:7]
            if not clean(client) or not clean(task) or clean(client).lower() == "client":
                continue
            client = {"Hamliton": "Hamilton"}.get(clean(client), clean(client))
            if person:
                people.add(clean(person))
            plans.append(dict(client=client, task=clean(task), existing=clean(existing),
                              checkpoint=clean(check), owner=clean(person),
                              target=parse_date(target), status=clean(status) or "Not started"))

    out = []
    w = out.append
    w("-- Generated by scripts/import_workbook.py from 'Client Task List_Automation.xlsx'")
    w("-- Safe to re-run: uses ON CONFLICT so existing rows are kept.")
    w("begin;")
    w("")
    w("-- Employees (emails are blank: add them on the Team page or below, then people can sign in)")
    w(f"insert into public.employees (full_name, role) values ('Palak', 'admin') on conflict (full_name) do nothing;")
    for p in sorted(people):
        role = "manager" if p in MANAGERS else "employee"
        w(f"insert into public.employees (full_name, role) values ({q(p)}, '{role}') on conflict (full_name) do nothing;")
    w("")
    w("-- Clients")
    for c in list(CLIENT_NAMES.values()) + EXTRA_CLIENTS:
        w(f"insert into public.clients (name) values ({q(c)}) on conflict (name) do nothing;")
    w("")
    w("-- Task master (recurring templates)")
    for t in templates:
        w(
            "insert into public.task_templates (client_id, category, title, frequency, weekday, day_of_month, "
            "estimated_hours, download_hours, execution_hours, default_assignee_id, default_reviewer_id, "
            "automation_url, automation_note, checking_built_in, sop_type, automation_target, raw_time_text, "
            "needs_review, sort_order, start_date)\n"
            f"select c.id, {q(t['category'])}, {q(t['title'])}, '{t['frequency']}', {q(t['weekday'])}, {q(t['day_of_month'])}, "
            f"{q(t['estimated_hours'])}, {q(t['download_hours'])}, {q(t['execution_hours'])}, "
            f"(select id from public.employees where full_name = {q(t['assignee'])}), "
            f"(select id from public.employees where full_name = {q(t['reviewer'])}), "
            f"{q(t['automation_url'])}, {q(t['automation_note'])}, {q(t['checking_built_in'])}, {q(t['sop_type'])}, "
            f"{q(t['automation_target'])}, {q(t['raw_time_text'])}, {q(t['needs_review'])}, {t['sort_order']}, date '2026-11-02'\n"
            f"from public.clients c where c.name = {q(t['client'])}\n"
            "on conflict (client_id, title) do nothing;"
        )
    w("")
    w("-- Client access: each employee can see the clients they work on")
    w("insert into public.employee_clients (employee_id, client_id)")
    w("select distinct e, client_id from (")
    w("  select default_assignee_id as e, client_id from public.task_templates where default_assignee_id is not null")
    w("  union select default_reviewer_id, client_id from public.task_templates where default_reviewer_id is not null")
    w(") s on conflict do nothing;")
    w("")
    w("-- Automation plan of action")
    for p in plans:
        w(
            "insert into public.automation_plans (client_id, task_title, existing_automation, checkpoint, owner_id, target_date, status)\n"
            f"select c.id, {q(p['task'])}, {q(p['existing'])}, {q(p['checkpoint'])}, "
            f"(select id from public.employees where full_name = {q(p['owner'])}), {q(p['target'])}, {q(p['status'])}\n"
            f"from public.clients c where c.name = {q(p['client'])}\n"
            "on conflict (client_id, task_title) do nothing;"
        )
    w("")
    w("-- Create this week's and next two weeks' work from the task master")
    w("select public.generate_recurring_assignments(date_trunc('week', current_date)::date, current_date + 14);")
    w("")
    w("commit;")
    print("\n".join(out))
    print(f"-- {len(templates)} templates, {len(plans)} automation plans, {len(people)} people", file=sys.stderr)
    nr = sum(1 for t in templates if t["needs_review"])
    print(f"-- {nr} templates flagged needs_review", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Client Task List_Automation.xlsx")
