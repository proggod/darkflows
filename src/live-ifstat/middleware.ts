import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Remove runtime declaration as it's not supported in middleware
// export const runtime = 'nodejs';

// List of paths that don't require authentication
const publicPaths = [
  '/login',
  '/api/login',
  '/api/auth/check-setup',
  '/api/auth/save-credentials',
  '/api/auth/update-system-passwords',
  '/api/auth/verify-credentials',
  '/_next',
  '/favicon.ico'
];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer-when-cross-origin');
  


  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return response;
  }

  const token = request.cookies.get('session');

  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // For web routes, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.SESSION_SECRET || 'development-secret'),
      { algorithms: ['HS256'] }
    );
    return response;
  } catch (error) {
    console.error('JWT verification failed:', error);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  } finally {
  }
}

// Configure which paths should be processed by the middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}; 