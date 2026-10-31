import { staffSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await staffSession();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (session.status !== 'authorized') return Response.json({ error: 'Staff access required' }, { status: session.status === 'unauthenticated' ? 401 : session.status === 'forbidden' ? 403 : 503, headers });
  if (session.user.role !== 'admin') return Response.json({ error: 'Admin role required' }, { status: 403, headers });
  return Response.json({ authorized: true, role: session.user.role }, { headers });
}
