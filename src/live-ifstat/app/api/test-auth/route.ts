import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../lib/auth';

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  
  return NextResponse.json({ 
    message: 'If you see this, you are authenticated',
    timestamp: new Date().toISOString()
  });
} 