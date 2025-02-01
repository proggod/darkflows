import { NextResponse } from 'next/server';
import { validateCredentials } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body; // Only get password since username is not needed

    const isValid = await validateCredentials(password);
    
    if (!isValid) {
      return new NextResponse(null, { status: 401 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Login error:', error);
    return new NextResponse(null, { status: 500 });
  }
} 