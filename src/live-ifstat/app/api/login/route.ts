import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    const success = await validateCredentials(password);

    if (success) {
      const sessionResponse = await createSession();
      const response = NextResponse.json({ success: true });
      
      sessionResponse.headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      
      return response;
    } else {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
} 