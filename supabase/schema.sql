-- Supabase Schema for Mohammad Akram's Job Application Tracker
-- Run this in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.job_applications (
    job_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'Not Applied',
    comments TEXT DEFAULT '',
    applied_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Allow public read/insert/update so the client app can sync smoothly
CREATE POLICY "Allow public read on job_applications" 
ON public.job_applications 
FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Allow public insert on job_applications" 
ON public.job_applications 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Allow public update on job_applications" 
ON public.job_applications 
FOR UPDATE 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);
