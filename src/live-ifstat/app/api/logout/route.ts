import { NextResponse } from 'next/server';
import { clearSession } from '../../lib/session';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    await clearSession(response);
    return response;
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
} 