import { requireLocalRequest } from '@/automation/core/localRequest';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/automation/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireLocalRequest(req);
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

    if (action === 'MEMORY_LIST') return NextResponse.json({ entries: session.selectedMemory.list() }, { headers: { 'Cache-Control': 'no-store' } });
    if (action === 'MEMORY_PICK_STATUS') return NextResponse.json({ picker: session.fieldPicker.status() }, { headers: { 'Cache-Control': 'no-store' } });
    if (action === 'MEMORY_PICK_CANCEL') { await session.fieldPicker.cancel(); return NextResponse.json({ success: true }); }
    if (action === 'MEMORY_DELETE') {
      if (typeof body.id !== 'string') throw new Error('Question ID required.');
      session.selectedMemory.remove(body.id);
      return NextResponse.json({ entries: session.selectedMemory.list() });
    }
    if (action === 'MEMORY_SAVE') {
      const selected = session.fieldPicker.status().selected;
      if (!selected || selected.id !== body.selectedId) throw new Error('Select a field again before saving.');
      if (typeof body.answer !== 'string' || !['site', 'all'].includes(body.scope)) throw new Error('Answer and scope required.');
      session.selectedMemory.save(selected, body.answer, body.scope);
      await session.fieldPicker.cancel();
      return NextResponse.json({ entries: session.selectedMemory.list() });
    }
    if (['MEMORY_PICK_START', 'AUTH_OPEN', 'AUTH_FILL'].includes(action)) {
      const blockedStates = ['STARTING', 'OPENING_APPLICATION', 'FORM_DETECTED', 'FILLING_FORM', 'CONTINUING'];
      if (blockedStates.includes(session.stateManager.getState())) throw new Error('Wait for the current page scan to finish.');
      if (action === 'MEMORY_PICK_START') {
        const page = await session.browserManager.pickerPage(session.job.applyUrl);
        await session.fieldPicker.start(page);
        return NextResponse.json({ success: true });
      }
      if (session.stateManager.getState() === 'WAITING_FOR_HUMAN') throw new Error('Answer or skip the pending application question before opening Authentication.');
      await session.fieldPicker.cancel();
      const account = session.authentication.account(body.accountId);
      if (action === 'AUTH_OPEN') {
        await session.browserManager.ensureActivePage(session.job.applyUrl);
        const page = await session.browserManager.openAuthenticationPage(account.loginUrl);
        session.authenticationPages.set(account.id, page);
        return NextResponse.json({ message: 'Sign-in page opened in Chromium. Complete sign-in there, or use Fill login for a saved password account.' });
      }
      const page = session.authenticationPages.get(account.id);
      if (!page || page.isClosed()) throw new Error('Use Open sign-in for this account first.');
      await page.bringToFront();
      return NextResponse.json({ message: await session.authentication.fill(account.id, page) });
    }
    if (session.fieldPicker.status().active && action !== 'ABORT') throw new Error('Finish or cancel field selection before running another browser action.');

    if (action === 'ABORT') {
      await session.abort();
      return NextResponse.json({ success: true, message: 'Automation aborted' });
    }

    if (action === 'RELAUNCH_BROWSER') {
      await session.browserManager.ensureActivePage(session.job.applyUrl);
      return NextResponse.json({ success: true, message: 'Browser reopened / brought to front' });
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
      return NextResponse.json({ error: 'Whole-page learning has been removed. Use Remember a field to select one question.' }, { status: 410 });
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
      rememberAnswer: rememberAnswer === true,
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json({ status: session.stateManager.getStatus() });
}
