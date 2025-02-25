'use server'

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import User from '@/models/User'
import connectDB from '@/lib/mongodb'
import { cache } from 'react'

// Near the top of the file


// Helper function to set session cookie
async function setSessionCookie(token: string) {
  'use server'
  try {
    logAuthAttempt('COOKIE_SET_START', {
      timestamp: new Date().toISOString(),
      tokenLength: token.length,
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      }
    });

    const cookieStore = await cookies()
    await cookieStore.set({
      name: 'session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    // Verify the cookie was set by trying to read it back
    const verifySet = cookieStore.get('session')
    
    logAuthAttempt('COOKIE_SET_COMPLETE', {
      timestamp: new Date().toISOString(),
      success: !!verifySet,
      cookieValue: verifySet ? {
        length: verifySet.value.length,
        firstChar: verifySet.value[0],
        lastChar: verifySet.value[verifySet.value.length - 1]
      } : null
    });
  } catch (error) {
    logAuthAttempt('COOKIE_SET_ERROR', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export const getSession = cache(async () => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')
    
    logAuthAttempt('GET_SESSION', {
      timestamp: new Date().toISOString(),
      hasToken: !!token,
      tokenDetails: token ? {
        length: token.value.length,
        firstChar: token.value[0],
        lastChar: token.value[token.value.length - 1]
      } : null
    });
    
    return token?.value
  } catch (error) {
    logAuthAttempt('GET_SESSION_ERROR', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
})

// Add detailed logging for authentication flow
function logAuthAttempt(stage: string, data: Record<string, unknown>) {
  void stage;
  void data;
  //console.log(`🔐 Auth [${stage}]:`, JSON.stringify(data, null, 2));
}

export const verifySession = cache(async () => {
  const token = await getSession()

  logAuthAttempt('SESSION_VERIFY', {
    timestamp: new Date().toISOString(),
    hasToken: !!token,
    tokenLength: token?.length
  });

  if (!token) {
    logAuthAttempt('NO_SESSION', {
      timestamp: new Date().toISOString()
    });
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

    logAuthAttempt('SESSION_VALID', {
      timestamp: new Date().toISOString(),
      payload: verified.payload
    });

    // Ensure we only return serializable data
    const payload = verified.payload as {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: String(payload.role) as 'user' | 'admin'
    }
  } catch (error) {
    logAuthAttempt('SESSION_INVALID', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    redirect('/login')
  }
})

// Add this near your login/verification logic

// Define our state type
interface LoginState {
  error?: string;
  success: boolean;
  redirectTo?: string;
}

export async function login(
  state: LoginState,
  formData?: FormData
): Promise<LoginState> {
  if (!formData) return state;
  
  try {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    logAuthAttempt('LOGIN_ATTEMPT', {
      timestamp: new Date().toISOString(),
      email,
      passwordLength: password?.length,
      jwtSecret: {
        exists: !!process.env.JWT_SECRET,
        length: process.env.JWT_SECRET?.length,
        firstChar: process.env.JWT_SECRET?.[0],
        lastChar: process.env.JWT_SECRET?.[process.env.JWT_SECRET.length - 1]
      }
    });

    await connectDB()
    const user = await User.findOne({ email })
    
    logAuthAttempt('USER_LOOKUP', {
      timestamp: new Date().toISOString(),
      userFound: !!user,
      userApproved: user?.approved,
      userId: user?._id?.toString()
    });
    
    if (!user || !user.approved) {
      logAuthAttempt('AUTH_FAILED', {
        reason: !user ? 'USER_NOT_FOUND' : 'USER_NOT_APPROVED',
        timestamp: new Date().toISOString()
      });
      return { error: 'Invalid credentials', success: false }
    }

    const isValid = await user.comparePassword(password)
    
    logAuthAttempt('PASSWORD_CHECK', {
      timestamp: new Date().toISOString(),
      isValid,
      userId: user._id.toString()
    });

    if (!isValid) {
      return { error: 'Invalid credentials', success: false }
    }

    // Create session token with only serializable data
    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    };

    logAuthAttempt('TOKEN_GENERATION', {
      timestamp: new Date().toISOString(),
      payload: tokenPayload
    });

    const token = await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET))

    logAuthAttempt('TOKEN_CREATED', {
      timestamp: new Date().toISOString(),
      tokenLength: token.length,
      firstChar: token[0],
      lastChar: token[token.length - 1]
    });

    await setSessionCookie(token)
    
    logAuthAttempt('LOGIN_SUCCESS', {
      timestamp: new Date().toISOString(),
      userId: user._id.toString(),
      role: user.role
    });

    return { success: true, redirectTo: '/admin' }
  } catch (error) {
    logAuthAttempt('LOGIN_ERROR', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Login error:', error)
    return { error: 'Authentication failed', success: false }
  }
}

export async function logout() {
  'use server'
  const cookieStore = await cookies()
  await cookieStore.delete('session')
  redirect('/login')
} 