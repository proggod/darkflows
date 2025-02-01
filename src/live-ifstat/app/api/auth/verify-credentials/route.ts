import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs/promises';

const CREDENTIALS_FILE = '/etc/darkflows/admin_credentials.json';

export async function POST(request: NextRequest) {
  try {
    const { username, hashedPassword } = await request.json();
    const content = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    const credentials = JSON.parse(content);
    
    if (credentials.username === username && credentials.hashedPassword === hashedPassword) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Failed to verify credentials:', error);
    return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
  }
} 