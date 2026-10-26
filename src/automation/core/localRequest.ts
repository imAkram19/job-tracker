import { NextRequest } from 'next/server';

export function requireLocalRequest(req: NextRequest): void {
  if (process.env.VERCEL) throw new Error('Open the desktop EXE to use local memory and Authentication.');
  const allowed = new Set(['localhost', '127.0.0.1', '[::1]']);
  const url = new URL(req.url);
  if (!allowed.has(url.hostname)) throw new Error('This feature is only available on the local desktop server.');
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).origin !== url.origin) throw new Error('Cross-site requests are not allowed.');
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new Error('Cross-site requests are not allowed.');
}
