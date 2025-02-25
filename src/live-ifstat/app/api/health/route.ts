import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
} 