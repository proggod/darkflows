import { verifySession } from './session';
import { NextResponse } from 'next/server';

export async function requireAuth() {
  const session = await verifySession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
} 