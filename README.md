# Mohammad Akram | Tech Job Application Command Center 🎯

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
