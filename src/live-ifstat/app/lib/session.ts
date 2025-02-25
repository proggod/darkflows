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
        new TextEncoder().encode(process.env.SESSION_SECRET),
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
      new TextEncoder().encode(process.env.SESSION_SECRET),
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
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));

    const response = NextResponse.json({ success: true });

    // Set cookie in both ways to ensure it's set
    const cookieStore = await cookies();
    await cookieStore.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);

    // Also set explicit Set-Cookie header
    response.headers.set(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    );


    return response;
  } catch (error) {
    console.error('createSession error:', error);
    return NextResponse.json({ success: false });
  } finally {
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

export async function validateCredentials(password: string) {
  try {
    const credentialsFile = '/etc/darkflows/admin_credentials.json';
    
    const fileContent = await fs.readFile(credentialsFile, 'utf-8');
    
    const { hashedPassword } = JSON.parse(fileContent);
    
    const isValid = await bcrypt.compare(password, hashedPassword);
    
    return isValid;
  } catch (error) {
    console.error('validateCredentials error:', error);
    return false;
  } finally {
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