import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import 'server-only';
import { headers } from 'next/headers';

const secretKey = process.env.SESSION_SECRET || 'your-secret-key-min-32-chars-long';
const encodedKey = new TextEncoder().encode(secretKey);

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password + secretKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(hashBuffer))));
}

export async function validateCredentials(username: string, password: string) {
  try {
    // Get host from headers
    const headersList = await headers();
    const host = await headersList.get('host') || '';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    // Check if this is first-time setup
    const setupResponse = await fetch(`${baseUrl}/api/auth/check-setup`);
    const { isFirstTime } = await setupResponse.json();

    const hashedPassword = await hashPassword(password);

    if (isFirstTime) {
      // Save new credentials
      const saveResponse = await fetch(`${baseUrl}/api/auth/save-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, hashedPassword })
      });
      return saveResponse.ok;
    }

    // Verify existing credentials
    const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, hashedPassword })
    });
    return verifyResponse.ok;
  } catch (error) {
    console.error('Credential validation error:', error);
    return false;
  }
}

export async function createSession() {
  const session = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(encodedKey);

  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return session;
}

export async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;

  try {
    const verified = await jwtVerify(session, encodedKey);
    return verified.payload;
  } catch {
    return null;
  }
}

export async function isLoggedIn() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return false;

  try {
    await jwtVerify(session, encodedKey);
    return true;
  } catch {
    return false;
  }
} 