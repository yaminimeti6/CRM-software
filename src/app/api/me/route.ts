import { staffSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await staffSession();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (session.status === 'authorized') return Response.json(session.user, { headers });
  const status = session.status === 'unauthenticated' ? 401 : session.status === 'forbidden' ? 403 : 503;
  return Response.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Active staff membership required' : 'Authentication service unavailable' }, { status, headers });
}
