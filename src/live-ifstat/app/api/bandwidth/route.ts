import { NextResponse } from 'next/server';
import fs from 'fs/promises';

export async function GET() {
  try {
    const data = await fs.readFile('/dev/shm/bandwidth.json', 'utf8');
    const parsedData = JSON.parse(data);
    return NextResponse.json(parsedData);
  } catch (error) {
    console.error('Error reading bandwidth data:', error);
    // Return a safe default response
    return NextResponse.json({
      timestamp: Date.now(),
      hosts: {},
      status: 'unknown'
    });
  }
} 