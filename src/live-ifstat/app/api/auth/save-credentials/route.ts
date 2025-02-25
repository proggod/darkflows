import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs/promises';
import { hashPassword } from '@/lib/session';

const CREDENTIALS_FILE = '/etc/darkflows/admin_credentials.json';

export async function POST(request: NextRequest) {
  console.log('=== POST /api/auth/save-credentials ===');
  try {
    const { password } = await request.json();
    
    // Hash the password before saving
    const hashedPassword = await hashPassword(password);
    
    console.log('Creating directory...');
    await fs.mkdir('/etc/darkflows', { recursive: true });
    
    console.log('Writing credentials file...');
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify({ hashedPassword }));
    console.log('Credentials saved successfully');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save credentials:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return NextResponse.json({ 
      error: 'Failed to save credentials',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 