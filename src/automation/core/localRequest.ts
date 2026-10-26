import { NextRequest } from 'next/server';

export function requireLocalRequest(req: NextRequest): void {
  if (process.env.VERCEL) throw new Error('Open the desktop EXE to use local memory and Authentication.');
  const allowed = new Set(['localhost', '127.0.0.1', '[::1]']);
  const url = new URL(req.url);
  // NextURL normalizes loopback IPs to localhost. Host retains the address
  // actually requested by the browser, including the desktop server's port.
  const host = req.headers.get('host');
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) {
    throw new Error('This feature is only available on the local desktop server.');
  }
  const requested = new URL(`${url.protocol}//${host}`);
  if (!allowed.has(url.hostname) || !allowed.has(requested.hostname)) {
    throw new Error('This feature is only available on the local desktop server.');
  }
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).origin !== requested.origin) throw new Error('Cross-site requests are not allowed.');
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new Error('Cross-site requests are not allowed.');
}
