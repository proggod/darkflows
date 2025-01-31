import { NextResponse } from 'next/server';
import { isLoggedIn } from '../../../lib/session';

export async function GET() {
  const authenticated = await isLoggedIn();
  return NextResponse.json(
    { authenticated },
    { status: authenticated ? 200 : 401 }
  );
} 