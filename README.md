# Job Tracker 🎯

A high-performance, mobile-responsive web application built with **Next.js 14 (App Router)**, **React**, **Tailwind CSS**, and **Supabase Real-Time Cloud Sync** to track and apply to verified permanent full-time entry-level tech jobs.

---

## ✨ Key Features

1. **Chronological Job Feed**:
   - Jobs are sorted by **Date Posted** (newest first) by default so Akram can apply to fresh postings immediately.
   - Freshness indicators: `Today`, `1 day ago`, `2 days ago`.
2. **Interactive Application Status Tracking**:
   - Status dropdown with colored visual badges:
     - ⏳ `Not Applied`
     - 📤 `Applied` (automatically records application timestamp)
     - 🎙️ `Interviewing`
     - 🎉 `Offer`
     - ❌ `Rejected`
     - 📁 `Archived`
3. **Custom Notes & Recruiter Comments**:
   - Inline notes view + dedicated notes modal.
   - Saves recruiter names, interview rounds, and application IDs.
   - Automatically synchronizes to Supabase PostgreSQL and cached in LocalStorage.
4. **1-Click Application Copilot**:
   - **Copy 60-Second Pitch**: Ready to paste into LinkedIn recruiter messages or cover letters.
   - **Candidate Dossier Modal**: Instant copy cheat-sheet for standard ATS screening fields (graduation year, notice period: immediate, salary expectations).
5. **Mobile-First Responsive Design**:
   - Full widescreen table layout on desktop.
   - Touch-friendly card-based layout on smartphones and tablets.
6. **Data Portability**:
   - 1-click export to CSV spreadsheet (`Akram_Job_Applications_YYYY-MM-DD.csv`).
   - JSON backup & restore.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router, Server & Client Components)
- **Styling:** Tailwind CSS + Radix-inspired design system
- **Icons:** Lucide React
- **Cloud Database:** Supabase PostgreSQL (`@supabase/supabase-js`)
- **Hosting / CI/CD:** Vercel (connected to GitHub)

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

---

## ☁️ Deploying to Vercel

1. Push this repository to GitHub: `https://github.com/imAkram19/job-tracker`
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **Import Project**.
3. Select `job-tracker`.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://dmazxqrxthngyniwqrkn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `sb_publishable_bnWqSGPwc3Q-6jvH2YYAmA_FCdzX3DI`
5. Click **Deploy**. Vercel will build and deploy the app in under 60 seconds!

---

## 🗄️ Supabase Database Setup

To enable cloud sync across all devices, run this SQL script in your [Supabase SQL Editor](https://supabase.com/dashboard/project/dmazxqrxthngyniwqrkn/sql/new):

```sql
CREATE TABLE IF NOT EXISTS public.job_applications (
    job_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'Not Applied',
    comments TEXT DEFAULT '',
    applied_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on job_applications" 
ON public.job_applications FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on job_applications" 
ON public.job_applications FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update on job_applications" 
ON public.job_applications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
```

---

## 🔄 Daily Scraping & Feed Update Workflow

When you scrape fresh jobs using your MCP agent:
1. Save the new job items into `src/data/jobs.json`.
2. Commit and push:
   ```bash
   git add src/data/jobs.json
   git commit -m "feat: add 20 new scraped jobs [YYYY-MM-DD]"
   git push origin master
   ```
3. Vercel automatically deploys the updated job feed to the live website.

## Desktop EXE and local Playwright

Double-click `AkramJobTracker.exe` in the project folder. It starts a hidden production server and opens the tracker; you do not need to run `npm run dev`. Click Auto Fill inside that window to open the separate Chromium application browser.

The launcher requires Node.js, installed project dependencies, and Playwright Chromium (`npx playwright install chromium`). It uses `.next-desktop` for its production build, leaving `.next` available for normal development/Vercel. A missing or outdated desktop build is rebuilt automatically; the first launch can take a few minutes. The EXE must stay beside `package.json` and `node_modules`.

The launcher uses a free loopback port in 3000–3009 and verifies `/api/automation/health` before opening the tracker. Startup failures appear in a dialog and `logs/app-server.log`. Use the system-tray menu to reopen the tracker or exit its owned server. After editing launcher source, close the EXE and run `powershell -File launcher/build.ps1` to rebuild it.

Vercel hosts the website, but the current automation APIs run on this PC. Opening the Vercel page does not connect it to the local EXE. Use the tracker window opened by the EXE for Auto Fill.

To regression-test the compiled desktop automation, run `node launcher/test-production.cjs` after a desktop build. It opens headed Chromium, intercepts every page request with a local diagnostic document, checks the status stream, and disconnects it. It does not contact employers or submit applications.

### Selected question memory

In the desktop application assistant, choose **Remember a field**, then **Choose field in browser**. Hover over the application field in Chromium and click it, return to the assistant, confirm its answer, and select **Save this question**. Escape cancels selection. The default scope is the current website; optionally reuse the exact question on any website. Saved questions can be removed in the same panel.

Whole-page learning has been removed. Search boxes and sign-in fields are excluded, and editing an answer no longer silently memorizes it. Selected memories match the normalized question and field type; changed dropdown options require review. Custom widgets and embedded forms may still need manual filling.

### Portal authentication

Choose **Authentication → Add account** to save separate accounts for different portals (or multiple accounts on one portal). Password accounts support **Open sign-in**, then **Fill login**. Filling requires the saved website origin and unambiguous login fields; you review and submit sign-in yourself. For username-first flows, continue in Chromium, then use Fill login again on the password step.

Google, LinkedIn, and SSO entries open the portal so you can choose its provider button and complete sign-in and verification yourself. Browser sessions are not persisted across restarts. Existing answer-bank entries are not imported as credentials.

Selected questions and account records live in %LOCALAPPDATA%/AkramJobTracker, outside the repository and cloud QA bank. Passwords use Windows DPAPI encryption bound to the current Windows account. These features use the desktop/local server, not the hosted Vercel page.
