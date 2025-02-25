import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { use } from 'react'

// Helper function to get token
const getSessionToken = cache(async () => {
  'use server'
  const cookieStore = cookies()
  const sessionCookie = await Promise.resolve(cookieStore)
  const token = sessionCookie.get('session')
  return token?.value
})

export const verifySession = cache(async () => {
  // Skip verification during build
  if (process.env.NEXT_PHASE === 'build' || process.env.NEXT_PHASE === 'static') {
    return {
      id: 'build-time',
      email: 'build@example.com',
      role: 'admin',
      approved: true
    };
  }

  // Comment out or remove the development bypass
  // if (process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true') {
  //   return {
  //     id: 'dev-user',
  //     email: 'dev@example.com',
  //     role: 'admin',
  //     approved: true
  //   };
  // }

  const token = await getSessionToken()

  if (!token) {
    redirect('/login')
  }

  try {
    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
      {
        algorithms: ['HS256']
      }
    )

    return verified.payload as {
      id: string
      email: string
      role: string
      approved: boolean
    }
  } catch {
    redirect('/login')
  }
})

// For client components
export function useSession() {
  return use(verifySession())
}

// Export the session cookie helper
export async function setSessionCookie(token: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookieOptions = {
    name: 'session',
    value: token,
    httpOnly: true,
    secure: isProduction,  // Only use secure in production
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  };

  // Fix: await the cookies() Promise
  const cookieStore = await cookies();
  cookieStore.set(cookieOptions);
} 