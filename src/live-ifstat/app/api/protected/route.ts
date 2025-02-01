import { NextResponse, NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Check authentication
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  // Continue with protected API logic
  return NextResponse.json({ message: 'Protected endpoint accessed successfully' });
} 