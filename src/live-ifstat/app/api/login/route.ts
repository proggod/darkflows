import { createSession, validateCredentials } from '../../lib/session';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body;

  const isValid = await validateCredentials(username, password);
  
  if (!isValid) {
    return new NextResponse(null, { status: 401 });
  }

  await createSession();
  return new NextResponse(null, { status: 200 });
} 