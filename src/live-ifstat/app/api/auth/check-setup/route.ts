import { NextResponse } from 'next/server';
import fs from 'fs/promises';

const CREDENTIALS_FILE = '/etc/darkflows/admin_credentials.json';

export async function GET() {
  try {
    await fs.access(CREDENTIALS_FILE);
    return NextResponse.json({ isFirstTime: false });
  } catch {
    return NextResponse.json({ isFirstTime: true });
  }
} 