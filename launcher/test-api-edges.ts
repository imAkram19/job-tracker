import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getCatchAll, POST as postCatchAll, DELETE as deleteCatchAll, PUT as putCatchAll, PATCH as patchCatchAll } from '../src/app/api/[...catchall]/route';
import { GET as getApiRoot, POST as postApiRoot } from '../src/app/api/route';
import { GET as getSessionById } from '../src/app/api/automation/session/[id]/route';
import { GET as getSessionRespond, POST as postSessionRespond } from '../src/app/api/automation/session/[id]/respond/route';
import { GET as getSessionStream } from '../src/app/api/automation/session/[id]/stream/route';
import { POST as postStart } from '../src/app/api/automation/start/route';
import { GET as getAccounts, POST as postAccounts, DELETE as deleteAccounts } from '../src/app/api/automation/accounts/route';
import { GET as getHealth } from '../src/app/api/automation/health/route';
import { AutomationSession, registerSession } from '../src/automation/runner';
import rawJobsData from '../src/data/jobs.json';
import { JobItem } from '../src/types/job';

function makeReq(url: string, options: {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
} = {}) {
  const headers = new Headers({
    host: '127.0.0.1:3000',
    origin: 'http://127.0.0.1:3000',
    'sec-fetch-site': 'same-origin',
    ...(options.headers || {})
  });
  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body !== undefined) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  return new NextRequest(new URL(url, 'http://127.0.0.1:3000'), init as any);
}

async function runTests() {
  console.log('--- Starting API Edge Cases Test Suite ---');
  let testsRun = 0;

  // 1. Root /api and Catch-All Not Found 404 Edge Cases
  {
    const resGetRoot = await getApiRoot();
    assert.equal(resGetRoot.status, 404);
    assert.deepEqual(await resGetRoot.json(), { error: 'Not found' });
    testsRun++;

    const resPostRoot = await postApiRoot();
    assert.equal(resPostRoot.status, 404);
    assert.deepEqual(await resPostRoot.json(), { error: 'Not found' });
    testsRun++;

    const resGetCatch = await getCatchAll();
    assert.equal(resGetCatch.status, 404);
    assert.deepEqual(await resGetCatch.json(), { error: 'Not found' });
    testsRun++;

    const resPostCatch = await postCatchAll();
    assert.equal(resPostCatch.status, 404);
    assert.deepEqual(await resPostCatch.json(), { error: 'Not found' });
    testsRun++;

    const resDelCatch = await deleteCatchAll();
    assert.equal(resDelCatch.status, 404);
    assert.deepEqual(await resDelCatch.json(), { error: 'Not found' });
    testsRun++;

    const resPutCatch = await putCatchAll();
    assert.equal(resPutCatch.status, 404);
    assert.deepEqual(await resPutCatch.json(), { error: 'Not found' });
    testsRun++;

    const resPatchCatch = await patchCatchAll();
    assert.equal(resPatchCatch.status, 404);
    assert.deepEqual(await resPatchCatch.json(), { error: 'Not found' });
    testsRun++;

    console.log('PASS 404 catch-all and /api root JSON responses');
  }

  // 2. Health Check
  {
    const res = await getHealth();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.application, 'akram-job-tracker');
    assert.equal(typeof data.desktop, 'boolean');
    testsRun++;
    console.log('PASS /api/automation/health endpoint');
  }

  // 3. Session Not Found Edge Cases
  {
    const nonExistentId = 'session_does_not_exist_' + Date.now();

    // GET /api/automation/session/[id]
    const resGetSession = await getSessionById(
      makeReq(`/api/automation/session/${nonExistentId}`),
      { params: { id: nonExistentId } }
    );
    assert.equal(resGetSession.status, 404);
    assert.deepEqual(await resGetSession.json(), { error: 'Session not found' });
    testsRun++;

    // GET /api/automation/session/[id]/respond
    const resGetRespond = await getSessionRespond(
      makeReq(`/api/automation/session/${nonExistentId}/respond`),
      { params: { id: nonExistentId } }
    );
    assert.equal(resGetRespond.status, 404);
    assert.deepEqual(await resGetRespond.json(), { error: 'Session not found' });
    testsRun++;

    // POST /api/automation/session/[id]/respond
    const resPostRespond = await postSessionRespond(
      makeReq(`/api/automation/session/${nonExistentId}/respond`, {
        method: 'POST',
        body: { action: 'MEMORY_LIST' }
      }),
      { params: { id: nonExistentId } }
    );
    assert.equal(resPostRespond.status, 404);
    assert.deepEqual(await resPostRespond.json(), { error: 'Session not found' });
    testsRun++;

    // GET /api/automation/session/[id]/stream
    const resStream = await getSessionStream(
      makeReq(`/api/automation/session/${nonExistentId}/stream`),
      { params: { id: nonExistentId } }
    );
    assert.equal(resStream.status, 404);
    const streamData = await resStream.json();
    assert.match(streamData.error, /Session not found/i);
    testsRun++;

    console.log('PASS session 404 Not Found handlers (direct, respond GET/POST, stream)');
  }

  // 4. Job Start & Not Found Edge Cases
  {
    // Missing jobId
    const resMissingJob = await postStart(makeReq('/api/automation/start', {
      method: 'POST',
      body: {}
    }));
    assert.equal(resMissingJob.status, 400);
    assert.deepEqual(await resMissingJob.json(), { error: 'jobId is required' });
    testsRun++;

    // Empty jobId
    const resEmptyJob = await postStart(makeReq('/api/automation/start', {
      method: 'POST',
      body: { jobId: '' }
    }));
    assert.equal(resEmptyJob.status, 400);
    assert.deepEqual(await resEmptyJob.json(), { error: 'jobId is required' });
    testsRun++;

    // Non-existent jobId
    const invalidJobId = 'JOB_INVALID_9999999';
    const resInvalidJob = await postStart(makeReq('/api/automation/start', {
      method: 'POST',
      body: { jobId: invalidJobId }
    }));
    assert.equal(resInvalidJob.status, 404);
    assert.deepEqual(await resInvalidJob.json(), { error: `Job with ID ${invalidJobId} not found` });
    testsRun++;

    console.log('PASS /api/automation/start job ID validation and 404 handling');
  }

  // 5. Respond Action Edge Cases on an Active Session
  {
    const sampleJob = (rawJobsData as JobItem[])[0];
    const session = new AutomationSession(sampleJob);
    registerSession(session);
    const sid = session.stateManager.getSessionId();

    try {
      // GET session details when session exists
      const resActiveSession = await getSessionById(
        makeReq(`/api/automation/session/${sid}`),
        { params: { id: sid } }
      );
      assert.equal(resActiveSession.status, 200);
      const activeData = await resActiveSession.json();
      assert.equal(activeData.status.sessionId, sid);
      testsRun++;

      // POST missing action
      const resNoAction = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: {}
        }),
        { params: { id: sid } }
      );
      assert.equal(resNoAction.status, 400);
      assert.deepEqual(await resNoAction.json(), { error: 'action is required' });
      testsRun++;

      // POST deprecated LEARN_FROM_PAGE returns 410 Gone
      const resDeprecatedLearn = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'LEARN_FROM_PAGE' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resDeprecatedLearn.status, 410);
      assert.match((await resDeprecatedLearn.json()).error, /removed/i);
      testsRun++;

      // POST deprecated MEMORY_SAVE_ENTERED returns 410 Gone
      const resDeprecatedSave = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'MEMORY_SAVE_ENTERED' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resDeprecatedSave.status, 410);
      assert.match((await resDeprecatedSave.json()).error, /tick beside a Saved question/i);
      testsRun++;

      // POST UPDATE_FIELD_VALUE without fieldLabel returns 400
      const resNoLabelUpdate = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'UPDATE_FIELD_VALUE', newValue: 'test' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resNoLabelUpdate.status, 400);
      assert.deepEqual(await resNoLabelUpdate.json(), { error: 'fieldLabel is required' });
      testsRun++;

      // POST REMOVE_FIELD without fieldLabel returns 400
      const resNoLabelRemove = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'REMOVE_FIELD' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resNoLabelRemove.status, 400);
      assert.deepEqual(await resNoLabelRemove.json(), { error: 'fieldLabel is required' });
      testsRun++;

      // POST unknown action when no prompt is awaiting human response returns 400
      const resUnknownPrompt = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'SUBMIT_ANSWER', answer: 'Yes' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resUnknownPrompt.status, 400);
      assert.deepEqual(await resUnknownPrompt.json(), { error: 'No prompt is currently awaiting a human answer' });
      testsRun++;

      // MEMORY_LIST returns entries array
      const resMemList = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'MEMORY_LIST' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resMemList.status, 200);
      const memListData = await resMemList.json();
      assert(Array.isArray(memListData.entries));
      testsRun++;

      // MEMORY_PICK_STATUS returns picker status object
      const resPickStatus = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'MEMORY_PICK_STATUS' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resPickStatus.status, 200);
      const pickData = await resPickStatus.json();
      assert.equal(typeof pickData.picker.active, 'boolean');
      testsRun++;

      // MEMORY_PICK_CANCEL returns success
      const resPickCancel = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'MEMORY_PICK_CANCEL' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resPickCancel.status, 200);
      assert.deepEqual(await resPickCancel.json(), { success: true });
      testsRun++;

      // ABORT action cleanly aborts session
      const resAbort = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'ABORT' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resAbort.status, 200);
      assert.deepEqual(await resAbort.json(), { success: true, message: 'Automation aborted' });
      testsRun++;

      console.log('PASS respond route action validation, deprecated actions, memory queries, and abort');
    } finally {
      await session.abort().catch(() => {});
    }
  }

  // 6. Security & Origin Validation Edge Cases
  {
    const sampleJob = (rawJobsData as JobItem[])[0];
    const session = new AutomationSession(sampleJob);
    registerSession(session);
    const sid = session.stateManager.getSessionId();

    try {
      // Disallowed external origin
      const resEvilOrigin = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'MEMORY_LIST' },
          headers: { origin: 'https://malicious-website.com' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resEvilOrigin.status, 500);
      assert.match((await resEvilOrigin.json()).error, /Cross-site requests are not allowed/i);
      testsRun++;

      // Cross-site fetch header
      const resCrossSite = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'MEMORY_LIST' },
          headers: { 'sec-fetch-site': 'cross-site' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resCrossSite.status, 500);
      assert.match((await resCrossSite.json()).error, /Cross-site requests are not allowed/i);
      testsRun++;

      // External host header
      const resBadHost = await postSessionRespond(
        makeReq(`/api/automation/session/${sid}/respond`, {
          method: 'POST',
          body: { action: 'MEMORY_LIST' },
          headers: { host: 'external-host.com' }
        }),
        { params: { id: sid } }
      );
      assert.equal(resBadHost.status, 500);
      assert.match((await resBadHost.json()).error, /only available on the local desktop server/i);
      testsRun++;

      console.log('PASS loopback and cross-site security defenses on session respond');
    } finally {
      await session.abort().catch(() => {});
    }
  }

  // 7. Accounts API Edge Cases
  {
    // GET accounts lists configured accounts
    const resGetAccounts = await getAccounts(makeReq('/api/automation/accounts'));
    assert.equal(resGetAccounts.status, 200);
    const accList = await resGetAccounts.json();
    assert(Array.isArray(accList.accounts));
    testsRun++;

    // POST accounts with wrong content-type
    const resBadContentType = await postAccounts(makeReq('/api/automation/accounts', {
      method: 'POST',
      body: 'plain text',
      headers: { 'content-type': 'text/plain' }
    }));
    assert.equal(resBadContentType.status, 415);
    assert.deepEqual(await resBadContentType.json(), { error: 'JSON required.' });
    testsRun++;

    // POST accounts with missing required fields
    const resEmptyAccount = await postAccounts(makeReq('/api/automation/accounts', {
      method: 'POST',
      body: {}
    }));
    assert.equal(resEmptyAccount.status, 400);
    assert.match((await resEmptyAccount.json()).error, /Provide a portal name, HTTPS sign-in URL, account, and sign-in method/i);
    testsRun++;

    // DELETE accounts with invalid non-string ID
    const resBadDelete = await deleteAccounts(makeReq('/api/automation/accounts', {
      method: 'DELETE',
      body: { id: 12345 }
    }));
    assert.equal(resBadDelete.status, 400);
    assert.deepEqual(await resBadDelete.json(), { error: 'Account ID required.' });
    testsRun++;

    console.log('PASS /api/automation/accounts validation and method edge cases');
  }

  console.log(`\n========================================`);
  console.log(`ALL ${testsRun} API EDGE TESTS PASSED SUCCESSFULLY!`);
  console.log(`========================================\n`);
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
