export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The launcher checks identity, not just whether something answers on port 3000.
export async function GET() {
  return Response.json({
    application: 'akram-job-tracker',
    desktop: process.env.AKRAM_DESKTOP === '1' && !process.env.VERCEL,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
