import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './app/lib/session';

export async function middleware(request: NextRequest) {
  // Public paths that don't require authentication
  const publicPaths = ['/login'];
  
  // Check if the current path is public
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname);

  // Get session
  const session = await verifySession();

  // Redirect to login if accessing protected route without session
  if (!session && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to home if accessing login with valid session
  if (session && isPublicPath) {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (e.g. robots.txt)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 