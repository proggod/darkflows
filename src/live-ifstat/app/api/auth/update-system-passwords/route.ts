import { NextResponse, NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  console.log('=== POST /api/auth/update-system-passwords ===');
  try {
    const { password } = await request.json();
    
    if (!password) {
      console.log('Error: No password provided');
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    console.log('Attempting to update Unix password...');
    const unixResult = await execAsync(`echo "darkflows:${password}" | chpasswd`);
    console.log('Unix password command result:', unixResult);

    console.log('Attempting to update Samba password...');
    const sambaResult = await execAsync(`(echo "${password}"; echo "${password}") | smbpasswd -s -a darkflows`);
    console.log('Samba password command result:', sambaResult);

    console.log('All passwords updated successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update system passwords:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json({ 
      error: 'Failed to update system passwords',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 