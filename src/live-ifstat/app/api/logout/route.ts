import { NextResponse } from 'next/server';
import { clearSession } from '../../lib/session';

export async function POST() {
  console.log('=== /api/logout POST START ===');
  try {
    const response = NextResponse.json({ success: true });
    await clearSession(response);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  } finally {
    console.log('=== /api/logout POST END ===');
  }
} 