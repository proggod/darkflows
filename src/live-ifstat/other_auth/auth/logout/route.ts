import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    await cookieStore.delete('session');
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
} 