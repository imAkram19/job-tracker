import { NextRequest } from 'next/server';
import { getSession } from '@/automation/runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  const session = getSession(sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = (event: string, data: any) => {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      writer.write(encoder.encode(payload));
    } catch {
      // Stream closed
    }
  };

  // Send initial full status snapshot
  sendEvent('status', session.stateManager.getStatus());

  // Subscribe to state manager events
  const onStateChange = (payload: any) => sendEvent('stateChange', payload);
  const onLog = (log: any) => sendEvent('log', log);
  const onFieldFilled = (field: any) => sendEvent('fieldFilled', field);
  const onHumanQuestion = (question: any) => sendEvent('humanQuestionRequired', question);

  session.stateManager.on('stateChange', onStateChange);
  session.stateManager.on('log', onLog);
  session.stateManager.on('fieldFilled', onFieldFilled);
  session.stateManager.on('humanQuestionRequired', onHumanQuestion);

  // Clean up on disconnect
  req.signal.addEventListener('abort', () => {
    session.stateManager.off('stateChange', onStateChange);
    session.stateManager.off('log', onLog);
    session.stateManager.off('fieldFilled', onFieldFilled);
    session.stateManager.off('humanQuestionRequired', onHumanQuestion);
    try {
      writer.close();
    } catch {
      // Ignore
    }
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
