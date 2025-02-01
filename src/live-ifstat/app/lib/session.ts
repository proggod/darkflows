export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import 'server-only';
import fs from 'fs/promises';
import { execAsync } from './utils/execAsync';

const secretKey = process.env.SESSION_SECRET || 'your-secret-key-min-32-chars-long';
const encodedKey = new TextEncoder().encode(secretKey);

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password + secretKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(hashBuffer))));
}

export async function validateCredentials(password: string) {
  try {
    console.log('=== Starting validateCredentials ===');
    
    // Check setup status directly via file system
    console.log('Checking setup status...');
    const CREDENTIALS_FILE = '/etc/darkflows/admin_credentials.json';
    let isFirstTime = false;
    
    try {
      await fs.access(CREDENTIALS_FILE);
      console.log('Credentials file exists - not first time setup');
    } catch {
      console.log('No credentials file - this is first time setup');
      isFirstTime = true;
    }

    if (isFirstTime) {
      console.log('=== Starting first-time setup flow ===');
      try {
        // Hash password first
        console.log('Hashing password...');
        const hashedPassword = await hashPassword(password);
        console.log('Password hashed successfully');

        // Save credentials
        console.log('Saving credentials...');
        await fs.mkdir('/etc/darkflows', { recursive: true });
        await fs.writeFile(CREDENTIALS_FILE, JSON.stringify({ hashedPassword }));
        console.log('Credentials saved successfully');

        // Update system passwords
        console.log('Updating system passwords...');
        await execAsync(`echo "darkflows:${password}" | chpasswd`);
        await execAsync(`(echo "${password}"; echo "${password}") | smbpasswd -s -a darkflows`);
        await execAsync(`pihole -a -p "${password}"`);
        console.log('System passwords updated successfully');

        console.log('Creating session...');
        await createSession();
        console.log('Session created successfully');
        return true;
      } catch (error) {
        console.error('Error during first-time setup:', error);
        return false;
      }
    } else {
      // Normal login flow
      console.log('=== Starting normal login flow ===');
      try {
        const content = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
        const { hashedPassword: storedHash } = JSON.parse(content);
        
        console.log('Hashing provided password...');
        const hashedInput = await hashPassword(password);
        
        if (hashedInput === storedHash) {
          console.log('Password verified, creating session...');
          await createSession();
          console.log('Session created successfully');
          return true;
        }
        
        console.log('Password verification failed');
        return false;
      } catch (error) {
        console.error('Error during login:', error);
        return false;
      }
    }
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}

export async function createSession() {
  try {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(encodedKey);

    const cookieStore = await cookies();
    
    const cookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24
    };
    
    cookieStore.set('session', token, cookieOptions);
    
    const response = new Response(null);
    const cookieHeader = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}`;
    response.headers.set('Set-Cookie', cookieHeader);

    return response;
  } catch (error) {
    throw error;
  }
}

export async function isLoggedIn() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return false;
    }

    // Just verify the token, we don't need the payload
    await jwtVerify(sessionCookie.value, encodedKey);
    return true;
  } catch {
    // Don't need the error variable if we're not using it
    return false;
  }
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