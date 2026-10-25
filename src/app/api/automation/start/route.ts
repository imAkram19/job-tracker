import { NextRequest, NextResponse } from 'next/server';
import rawJobsData from '@/data/jobs.json';
import { JobItem } from '@/types/job';
import { AutomationSession, registerSession, getActiveSessionByJobId } from '@/automation/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, forceNew } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const jobs = rawJobsData as JobItem[];
    const job = jobs.find((j) => String(j.id) === String(jobId));

    if (!job) {
      return NextResponse.json({ error: `Job with ID ${jobId} not found` }, { status: 404 });
    }

    // Vercel serverless lambdas do not have a desktop display to open headed Chrome
    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          error:
            'Playwright Browser Automation is designed to run locally on your machine so it can open headed Chrome on your screen. Run "npm run dev" locally to use Auto Fill!',
        },
        { status: 400 }
      );
    }

    // Check if there is already an active session for this job
    const existing = getActiveSessionByJobId(String(jobId));
    if (existing && !forceNew) {
      try {
        await existing.browserManager.ensureActivePage(existing.job.applyUrl);
        return NextResponse.json({
          sessionId: existing.stateManager.getSessionId(),
          status: existing.stateManager.getStatus(),
          message: 'Active session resumed for this job',
        });
      } catch (err) {
        console.warn('Could not resume existing session browser, starting fresh session:', err);
      }
    }

    const session = new AutomationSession(job);
    registerSession(session);

    // Launch automation asynchronously in headed mode
    session.run({ headless: false, autoClose: false }).catch((err) => {
      console.error('Session execution error:', err);
    });

    return NextResponse.json({
      sessionId: session.stateManager.getSessionId(),
      status: session.stateManager.getStatus(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
