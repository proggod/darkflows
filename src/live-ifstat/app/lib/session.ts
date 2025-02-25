export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import 'server-only';
import fs from 'fs/promises';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

const COOKIE_NAME = 'session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7 // 7 days
};

const getSessionSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set in production');
  }
  return secret || 'development-secret';
};

// Helper function to get session token
const getSessionToken = cache(async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME);
    return token?.value;
  } catch (error) {
    console.error('getSessionToken error:', error);
    return null;
  } finally {
  }
});

// Verify session and return payload or redirect
export const verifySession = cache(async () => {
  try {
    const token = await getSessionToken();

    if (!token) {
      redirect('/login');
    }

    try {
      const verified = await jwtVerify(
        token,
        new TextEncoder().encode(getSessionSecret()),
        {
          algorithms: ['HS256']
        }
      );
      return verified.payload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      redirect('/login');
    }
  } catch (error) {
    console.error('verifySession error:', error);
    redirect('/login');
  } finally {
  }
});

// Check if user is logged in without redirecting
export async function isLoggedIn() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    
    if (!sessionCookie?.value) return false;
    
    await jwtVerify(
      sessionCookie.value,
      new TextEncoder().encode(getSessionSecret()),
      {
        algorithms: ['HS256']
      }
    );
    return true;
  } catch (error) {
    console.error('isLoggedIn error:', error);
    return false;
  } finally {
  }
}

// Create and set session cookie
export async function createSession() {
  try {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(getSessionSecret()));

    const response = NextResponse.json({ success: true });
    
    // Set cookie in multiple ways to ensure it works in development
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Also set explicit Set-Cookie header
    response.headers.set(
      'Set-Cookie',
      `session=${token}; Path=/; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    );

    return response;
  } catch (error) {
    console.error('createSession error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

export async function validateCredentials(password: string) {
  try {
    if (process.env.NODE_ENV === 'development' && password === 'development') {
      return true;
    }

    const credentialsFile = '/etc/darkflows/admin_credentials.json';
    const fileContent = await fs.readFile(credentialsFile, 'utf-8');
    const { hashedPassword } = JSON.parse(fileContent);
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('validateCredentials error:', error);
    if (process.env.NODE_ENV === 'development') {
      // Allow login in development if credential file doesn't exist
      return password === 'development';
    }
    return false;
  }
}

// Helper function to clear session cookie
export async function clearSession(response: NextResponse) {
  try {
    const clearOptions = {
      name: COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: -1,
      expires: new Date(0)
    };

    // Clear using cookies API
    const cookieStore = await cookies();
    await cookieStore.set(clearOptions);

    // Also clear using response
    response.cookies.set(COOKIE_NAME, '', clearOptions);

    // Set explicit Set-Cookie header for immediate expiration
    response.headers.set(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
    );

  } catch (error) {
    console.error('Failed to clear session:', error);
  } finally {
  }
} 