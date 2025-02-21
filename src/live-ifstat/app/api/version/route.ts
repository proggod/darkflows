import { NextResponse } from 'next/server';

export async function GET() {
  // Increment version to trigger reset
  return NextResponse.json({ version: '1.0.1' });
} 