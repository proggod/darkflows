import { verifySession } from './session';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// Add paths that don't require authentication during setup
const SETUP_PATHS = [
  '/api/auth/check-setup',
  '/api/auth/save-credentials',
  '/api/auth/update-system-passwords',
  '/api/auth/verify-credentials'
];

export async function requireAuth(request: NextRequest) {
  // Allow setup-related endpoints without auth
  const path = request.nextUrl.pathname;
  if (SETUP_PATHS.includes(path)) {
    return null;
  }
  
  const session = await verifySession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
} 