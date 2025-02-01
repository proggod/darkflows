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

export async function validateCredentials(password: string) {
  try {
    const headersList = await headers();
    const host = await headersList.get('host') || '';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    const setupResponse = await fetch(`${baseUrl}/api/auth/check-setup`);
    const { isFirstTime } = await setupResponse.json();

    const hashedPassword = await hashPassword(password);

    if (isFirstTime) {
      // Update system passwords first
      const systemResponse = await fetch(`${baseUrl}/api/auth/update-system-passwords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!systemResponse.ok) {
        console.error('Failed to update system passwords');
        return false;
      }

      // Then save credentials
      const saveResponse = await fetch(`${baseUrl}/api/auth/save-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashedPassword })
      });

      if (saveResponse.ok) {
        await createSession();
        return true;
      }
      return false;
    }

    // Verify existing credentials
    const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashedPassword })
    });

    if (verifyResponse.ok) {
      await createSession();
      return true;
    }
    return false;

  } catch (error) {
    console.error('Credential validation error:', error);
    return false;
  }
}

async function createSession() {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(encodedKey);

  const cookieStore = await cookies();
  await cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 // 24 hours
  });
}

export async function verifySession() {
  try {
    const cookieStore = await cookies();
    const sessionValue = await cookieStore.get('session')?.value;

    if (!sessionValue) {
      return null;
    }

    const verified = await jwtVerify(sessionValue, encodedKey);
    return verified.payload;
  } catch {
    return null;
  }
}

export async function isLoggedIn() {
  try {
    const cookieStore = await cookies();
    const sessionValue = await cookieStore.get('session')?.value;

    if (!sessionValue) {
      return false;
    }

    await jwtVerify(sessionValue, encodedKey);
    return true;
  } catch {
    return false;
  }
} 