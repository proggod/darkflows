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
  try {
    // Allow setup-related endpoints without auth
    const path = request.nextUrl.pathname;
    if (SETUP_PATHS.includes(path)) {
      return null;
    }
    
    const session = await verifySession();
    
    if (!session) {
      const response = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
      
      // Add these cache control headers
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      
      return response;
    }
    
    // No response means auth passed, but still need to handle caching
    return null;
  } catch (error) {
    console.error('Auth error:', error);
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
} 
