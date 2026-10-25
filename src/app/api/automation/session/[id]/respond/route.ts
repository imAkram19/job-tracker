import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/automation/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: 'Playwright automation is only available when running locally.' },
        { status: 400 }
      );
    }

    const sessionId = params.id;
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, answer, rememberAnswer } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    if (action === 'ABORT') {
      await session.abort();
      return NextResponse.json({ success: true, message: 'Automation aborted' });
    }

    if (action === 'SCAN_PAGE_OVERVIEW') {
      const overview = await session.scanPageOverview();
      return NextResponse.json({ success: true, overview });
    }

    if (action === 'APPLY_BATCH_FIELDS') {
      const resolutions = body.resolutions || [];
      const result = await session.applyBatchFields(resolutions);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'LEARN_FROM_PAGE') {
      const result = await session.learnFromActivePage();
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'UPDATE_FIELD_VALUE') {
      const { fieldLabel, newValue, refillInBrowser } = body;
      if (!fieldLabel) {
        return NextResponse.json({ error: 'fieldLabel is required' }, { status: 400 });
      }
      await session.updateFieldValue(fieldLabel, newValue || '', refillInBrowser ?? true);
      return NextResponse.json({ success: true, message: `Field ${fieldLabel} updated` });
    }

    if (action === 'REMOVE_FIELD') {
      const { fieldLabel } = body;
      if (!fieldLabel) {
        return NextResponse.json({ error: 'fieldLabel is required' }, { status: 400 });
      }
      await session.removeField(fieldLabel);
      return NextResponse.json({ success: true, message: `Field ${fieldLabel} removed` });
    }

    if (action === 'SCAN_AND_FILL') {
      session.fillActivePage().catch((err) => {
        console.error('Error during on-demand page fill:', err);
      });
      return NextResponse.json({ success: true, message: 'Scan and fill started for current page' });
    }

    const resolved = session.humanManager.resolvePrompt({
      action,
      answer,
      rememberAnswer: rememberAnswer ?? true,
    });

    if (!resolved) {
      return NextResponse.json(
        { error: 'No prompt is currently awaiting a human answer' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
