# Deploying GATP Accounting Work

This guide takes the zip from your laptop to a live app on the **company** GitHub, Supabase and Vercel accounts. Nothing in the code is tied to your personal accounts. Every key comes from environment variables you set in Vercel.

Plan on about 45 minutes the first time.

```
GitHub (company org)  ──push──▶  Vercel (hosting + daily cron)  ──▶  Supabase (database + sign-in)
                                                                        ▲
                                                Google Cloud (Google sign-in for company emails)
```

---

## What you need before you start

| Account | Use the company one | Why |
|---|---|---|
| GitHub | Company organization (e.g. `gatp-solutions`) | Holds the code |
| Supabase | Company login, a new project | Database, Google/email sign-in |
| Vercel | The existing Vercel Pro team | Hosting, automatic deploys, daily scheduling job |
| Google Cloud | The company Google Workspace admin (or anyone allowed to create OAuth apps) | "Continue with Google" button |

On the company computer you also need **Git** (https://git-scm.com/downloads). Node.js 20.9 or newer is only needed if you want to run the app locally (optional).

---

## Step 1 — Put the code on the company GitHub

1. Sign in to GitHub with the company account. Click **New repository**.
   - Owner: the company organization
   - Name: `gatp-task-management`
   - Visibility: **Private**
   - Do **not** tick "Add a README" (the zip already has one)
   - Click **Create repository**
2. Unzip `gatp-task-management.zip` on the company computer.
3. Open a terminal (PowerShell on Windows, Terminal on Mac) **inside the unzipped folder** and run:

```bash
git init
git add .
git commit -m "GATP task management: first version"
git branch -M main
git remote add origin https://github.com/<COMPANY-ORG>/gatp-task-management.git
git push -u origin main
```

If Git asks you to sign in, use the company GitHub account. (If you prefer not to use the terminal, GitHub Desktop or the web page's "uploading an existing file" link also work — upload everything except `node_modules` and `.next`, which aren't in the zip anyway.)

> `.env.local` and other secret files are listed in `.gitignore`, so keys never end up on GitHub.

---

## Step 2 — Create the Supabase project

1. Go to https://supabase.com/dashboard and sign in with the company account.
2. **New project**.
   - Organization: the company one
   - Name: `gatp-task-management`
   - Database password: click **Generate**, then save it in the company password manager
   - Region: **South Asia (Mumbai)** — closest to the team
3. Wait 1–2 minutes until the project shows as ready.

## Step 3 — Create the tables and load the Excel data

In the Supabase project:

1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` from the zip in a text editor, copy **all** of it, paste it in, click **Run**. You should see "Success. No rows returned".
3. **New query** again. Copy all of `supabase/seed.sql`, paste, **Run**.
   The last line returns a number (around 470): those are this week's and the next two weeks' tasks, created from the recurring tasks.

The seed loads, from `Client Task List_Automation.xlsx`:
- 13 clients (every sheet, plus PMG and Bluntd from Sheet1)
- 8 people: Palak (admin), Krupali and Simran (managers), Satya, Jaini, Pooja, Pargat, Ayush
- 185 recurring tasks with their automation links, SOP flags, who does it and who checks it
- 39 rows of the Plan of Action (automation check points)

> Run the two files in this order, once each. Running `seed.sql` again is safe (it skips rows that exist). Running `0001_init.sql` twice fails because the tables already exist — that's expected.

## Step 4 — Copy the three Supabase values

All three are in **Project Settings → API Keys** (gear icon at the bottom of the left sidebar). The **Connect** button at the top of the project also shows the URL and publishable key.

| Value | Where exactly | Looks like |
|---|---|---|
| Project URL | Connect dialog, or Project Settings → Data API | `https://abcdxyz.supabase.co` |
| Publishable key | Project Settings → API Keys → "Publishable and secret API keys" tab → **Publishable key** | `sb_publishable_…` |
| Secret key | Same tab → **Secret keys** → `default` → click to reveal → copy | `sb_secret_…` |

If you only see a "Legacy API keys" tab with `anon` and `service_role`, click **Create new API keys** first. (The app also accepts the legacy `anon` / `service_role` keys, but Supabase is retiring them at the end of 2026.)

**The secret key bypasses all security rules.** Only paste it into Vercel's environment variables. Never into chat, email, the code, or a `NEXT_PUBLIC_` variable.

## Step 5 — Turn on Google sign-in

### 5a. Google Cloud (company Workspace account)

1. Go to https://console.cloud.google.com → create a project named `GATP Task Management` (or reuse a company one).
2. **APIs & Services → OAuth consent screen** (may be called "Google Auth Platform → Branding/Audience").
   - User type / Audience: **Internal** — only people in your Google Workspace can sign in. (Choose External only if staff use personal Gmail accounts.)
   - App name: `GATP Accounting Work`, support email: an admin address. Save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: `GATP Task Management`
   - Authorized JavaScript origins: your Vercel URL once you have it (Step 7), e.g. `https://gatp-task-management.vercel.app`, and `http://localhost:3000`
   - Authorized redirect URIs: **`https://<your-project-ref>.supabase.co/auth/v1/callback`** (Supabase shows this exact URL on the Google provider page — copy it from there)
   - Click **Create** and copy the **Client ID** and **Client secret**.

### 5b. Supabase

1. **Authentication → Sign In / Providers → Google** → enable.
2. Paste the Client ID and Client secret → **Save**.

### 5c. Email sign-in links (optional backup)

The login page also has "Email me a sign-in link". It works out of the box, but Supabase's built-in mail server only sends a handful of emails per hour. For daily use rely on Google, or add the company SMTP under **Authentication → Emails → SMTP Settings**.

## Step 6 — Tell Supabase where the app lives

**Authentication → URL Configuration**:

- **Site URL**: `https://gatp-task-management.vercel.app` (your real Vercel URL or custom domain)
- **Redirect URLs** → Add:
  - `https://gatp-task-management.vercel.app/**`
  - `http://localhost:3000/**` (for local testing)

If you add a custom domain later (e.g. `tasks.gatpsolutions.com`), add it here and in Google's origins too.

## Step 7 — Deploy on Vercel

1. Go to https://vercel.com → switch to the **company team** (top-left team switcher).
2. **Add New… → Project → Import Git Repository**. If the company GitHub org isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to the `gatp-task-management` repo.
3. Framework preset: **Next.js** (detected automatically). Leave build settings as they are.
4. Open **Environment Variables** and add every row from the table below (copy names exactly).
5. Click **Deploy**. The first build takes 1–2 minutes.
6. Note the URL Vercel gives you. If it differs from what you entered in Steps 5 and 6, update **Site URL / Redirect URLs** in Supabase, the **JavaScript origin** in Google, and `NEXT_PUBLIC_SITE_URL` in Vercel, then **Deployments → ⋯ → Redeploy**.

### Environment variables

| Name | Required | Where to get it | Example |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Step 4, Project URL | `https://abcdxyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Step 4, Publishable key | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | Yes | Step 4, Secret key. Server only. Used by the daily scheduling job. | `sb_secret_…` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your Vercel URL, no trailing slash | `https://gatp-task-management.vercel.app` |
| `CRON_SECRET` | Yes | Make one up: any random string of 32+ characters. On Mac/Linux run `openssl rand -hex 32`; or use a password generator. Vercel sends it to the daily job automatically. | `9f2c…e41a` |
| `ALLOWED_EMAIL_DOMAINS` | Recommended | Your company email domain(s), comma-separated. Anyone else is turned away at sign-in. Leave empty to allow any Google account. | `gatpsolutions.com` |
| `APP_TIMEZONE` | Optional | Time zone for "today", weeks and due dates. Default is `Asia/Kolkata`. | `Asia/Kolkata` |

Set them for **Production** and **Preview**. After changing any variable, redeploy for it to take effect.

## Step 8 — First sign-in (do this right after deploying)

1. Open the app URL and click **Continue with Google** with **your** company account.
2. **The first person to sign in becomes admin automatically.** You'll land on Dashboard.
3. Go to **Team**:
   - Open each person (Palak, Krupali, Simran, Satya, Jaini, Pooja, Pargat, Ayush), type their company email in **Sign-in email**, and **Save**. When they sign in with that address they're linked to their existing tasks.
   - Set Palak's role to **Admin**.
   - Adjust **Hours per week** if anyone isn't on 40.
4. Anyone who signs in before you've added their email appears under **Waiting for access**. Either click **Give access**, or — better — add that email to their existing row, which merges the two automatically.

## Step 9 — Confirm the recurring tasks

The Excel sheet recorded time in different ways ("2–3 hours weekly", "20 Min Monthly", monthly totals on the Saint Eyewear sheet). The import turned all of it into **hours per occurrence + a schedule**, and flagged every row it had to interpret.

1. **Recurring tasks → Hours to confirm** tab (about 129 rows).
2. Open each one, check **Repeats**, **On / Day of the month** and **Hours each time**. The original text from Excel is shown under the hours.
3. Untick **Hours need confirming** and **Save**. Upcoming occurrences nobody has started update automatically.
4. The **No default owner** tab lists tasks the sheet didn't give a person — set **Does it**.

Saint Eyewear note: that sheet's "Current total time (Per Task)" looked like a monthly total (e.g. "8 Hours (2 Hours per week)"), so weekly Saint tasks were divided by 4. Check those first.

## Step 10 — Check the daily scheduling job

`vercel.json` runs `/api/cron/generate` every day at 00:30 UTC (6:00 IST). It creates the next 14 days of recurring work and never duplicates anything.

- Vercel → your project → **Settings → Cron Jobs** should list it.
- Test it yourself:

```bash
curl -H "Authorization: Bearer <your CRON_SECRET>" https://gatp-task-management.vercel.app/api/cron/generate
# → {"ok":true,"created":0,...}   (0 means everything was already scheduled)
```

Managers can also click **Recurring tasks → Schedule** at any time.

---

## Everyday updates

- **Code changes**: push to `main` on GitHub → Vercel deploys automatically. Pushes to other branches get a preview URL.
- **Database changes**: add a new file like `supabase/migrations/0002_something.sql` and run it in the SQL Editor. Never edit or re-run `0001_init.sql` on a live database.
- **Backups**: Supabase Pro takes daily backups (Project Settings → Database → Backups). On the Free plan, export regularly or upgrade before relying on it.

## Run it locally (optional)

```bash
npm install
cp .env.example .env.local     # then fill in the same values as Vercel
npm run dev                    # http://localhost:3000
```

## Troubleshooting

| What you see | Fix |
|---|---|
| Build fails with "NEXT_PUBLIC_SUPABASE_URL and … must be set" | Add the env vars in Vercel, then redeploy |
| Google shows `redirect_uri_mismatch` | The redirect URI in Google must be exactly `https://<ref>.supabase.co/auth/v1/callback` |
| After Google sign-in you're back on the login page with "link expired" | Add your app URL with `/**` to Supabase → Authentication → URL Configuration → Redirect URLs |
| "That account isn't part of the company workspace" | The email's domain isn't in `ALLOWED_EMAIL_DOMAINS` |
| Stuck on "Waiting for access" | An admin needs to add your email on the Team page, or click Give access |
| Pages show "relation … does not exist" | `0001_init.sql` wasn't run on this project |
| No tasks anywhere | `seed.sql` wasn't run, or run Recurring tasks → Schedule |
| Cron returns 401 | `CRON_SECRET` in Vercel doesn't match the one in your curl command; redeploy after setting it |
| Someone became admin by mistake | In Supabase SQL Editor: `update employees set role = 'employee' where email = 'their@email';` |
