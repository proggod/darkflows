import { NextResponse } from 'next/server';
import fs from 'fs/promises';

export async function GET() {
  try {
    const data = await fs.readFile('/dev/shm/bandwidth.json', 'utf8');
    // The file already contains the correct format, so just return it directly
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading bandwidth data:', error);
    return NextResponse.json({
      timestamp: Date.now(),
      hosts: {},
      status: 'error'
    }, { status: 500 });
  }
} 