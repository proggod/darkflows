import { NextResponse } from 'next/server';
import fs from 'fs/promises';

const CREDENTIALS_FILE = '/etc/darkflows/admin_credentials.json';

export async function POST(request: Request) {
  try {
    const { username, hashedPassword } = await request.json();
    await fs.mkdir('/etc/darkflows', { recursive: true });
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify({ username, hashedPassword }));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save credentials:', error);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
} 