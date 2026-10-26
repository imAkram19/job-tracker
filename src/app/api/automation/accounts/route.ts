import { NextRequest, NextResponse } from 'next/server';
import { PortalAuthentication } from '@/automation/core/PortalAuthentication';
import { requireLocalRequest } from '@/automation/core/localRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const accounts = new PortalAuthentication();
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  try { requireLocalRequest(req); return reply({ accounts: accounts.list() }); }
  catch (err) { return reply({ error: err instanceof Error ? err.message : 'Unable to load accounts.' }, 400); }
}
export async function POST(req: NextRequest) {
  try {
    requireLocalRequest(req);
    if (!req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'JSON required.' }, 415);
    return reply({ accounts: await accounts.save(await req.json()) });
  } catch (err) { return reply({ error: err instanceof Error ? err.message : 'Unable to save account.' }, 400); }
}
export async function DELETE(req: NextRequest) {
  try {
    requireLocalRequest(req);
    const { id } = await req.json();
    if (typeof id !== 'string') return reply({ error: 'Account ID required.' }, 400);
    return reply({ accounts: await accounts.remove(id) });
  } catch (err) { return reply({ error: err instanceof Error ? err.message : 'Unable to remove account.' }, 400); }
}
