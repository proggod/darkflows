import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  try {
    const versionPath = '/usr/local/darkflows/version.txt';
    let version = '1.0.0'; // Default version

    if (fs.existsSync(versionPath)) {
      // Read first line only
      version = fs.readFileSync(versionPath, 'utf8')
                  .split('\n')[0]
                  .trim();
    }

    return NextResponse.json({ version });
  } catch (error) {
    console.error('Error reading version:', error);
    return NextResponse.json({ version: '1.0.0' });
  }
} 