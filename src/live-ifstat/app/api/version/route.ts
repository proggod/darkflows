import { NextResponse } from 'next/server';

const APP_VERSION = '0.40';

export async function GET() {
  // Add cache control headers
  return NextResponse.json(
    { version: APP_VERSION },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache'
      }
    }
  );
} 