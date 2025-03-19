import { NextResponse } from 'next/server';
import fs from 'fs/promises';

export async function GET() {
  try {
    const data = await fs.readFile('/dev/shm/bandwidth.json', 'utf8');
    const parsedData = JSON.parse(data);
    
    // Validate data structure
    if (!parsedData.hosts || typeof parsedData.hosts !== 'object') {
      return NextResponse.json({
        timestamp: Date.now(),
        hosts: {},
        status: 'error',
        message: 'Invalid data structure'
      });
    }
    
    // Create response with cache control headers
    const response = NextResponse.json(parsedData);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    // Return a safe default response
    return NextResponse.json({
      timestamp: Date.now(),
      hosts: {},
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 