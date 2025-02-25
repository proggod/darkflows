import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  console.log('\n=== /api/login POST START ===');
  try {
    const body = await request.json();
    const { password } = body;
    console.log('Login attempt received with password length:', password?.length);

    if (!password) {
      console.log('No password provided');
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    console.log('Validating credentials...');
    const success = await validateCredentials(password);
    console.log('Validation result:', success);

    if (success) {
      console.log('Login successful, creating session...');
      const response = await createSession();
      console.log('Session created, response headers:', Object.fromEntries(response.headers.entries()));
      return response;
    }

    console.log('Login failed - invalid credentials');
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  } finally {
    console.log('=== /api/login POST END ===\n');
  }
} 