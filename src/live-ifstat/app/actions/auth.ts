'use server'

import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { setSessionCookie } from '@/lib/session'
import { validateCredentials } from '@/lib/session'

export async function login(formData: FormData) {
  try {
    const password = formData.get('password') as string
    
    // Use validateCredentials to check password
    const success = await validateCredentials(password)

    if (success) {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(new TextEncoder().encode(process.env.SESSION_SECRET))

      await setSessionCookie(token)
      return { success: true }
    }

    return { error: 'Invalid credentials', success: false }
  } catch (error) {
    console.error('Login error:', error)
    return { error: 'Authentication failed', success: false }
  }
}

export async function logout() {
  'use server'
  const cookieStore = cookies()
  cookieStore.delete('session')
  redirect('/login')
} 