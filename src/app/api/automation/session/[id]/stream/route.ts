import { NextRequest } from 'next/server';
import { getSession } from '@/automation/runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession(params.id);
  if (!session) {
    return Response.json({ error: 'Session not found. Restart automation after restarting the desktop app.' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const onState = (data: unknown) => send('stateChange', data);
      const onLog = (data: unknown) => send('log', data);
      const onField = (data: unknown) => send('fieldFilled', data);
      const onQuestion = (data: unknown) => send('humanQuestionRequired', data);
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        req.signal.removeEventListener('abort', cleanup);
        session.stateManager.off('stateChange', onState);
        session.stateManager.off('log', onLog);
        session.stateManager.off('fieldFilled', onField);
        session.stateManager.off('humanQuestionRequired', onQuestion);
        try { controller.close(); } catch { /* Reader already cancelled. */ }
      };
      session.stateManager.on('stateChange', onState);
      session.stateManager.on('log', onLog);
      session.stateManager.on('fieldFilled', onField);
      session.stateManager.on('humanQuestionRequired', onQuestion);
      req.signal.addEventListener('abort', cleanup, { once: true });
      if (req.signal.aborted) { cleanup(); return; }
      send('status', session.stateManager.getStatus());
      heartbeat = setInterval(() => send('heartbeat', {}), 15000);
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  } });
}
