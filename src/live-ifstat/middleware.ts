import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Remove runtime declaration as it's not supported in middleware
// export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const publicPaths = ['/login', '/api/auth/check-setup', '/api/login', '/api/auth/save-credentials'];
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname);
  const session = request.cookies.get('session');

  if (!session && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isPublicPath) {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}; 