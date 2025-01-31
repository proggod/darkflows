import { requireAuth } from '../../lib/auth';

export async function GET() {
  // Check authentication
  const authResponse = await requireAuth();
  if (authResponse) return authResponse;

  // Continue with protected API logic
  return new Response('Protected data');
} 