import { NextResponse, NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const CREDENTIALS_FILE = '/etc/darkflows/admin_credentials.json';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    // Check if this is first-time setup
    try {
      await fs.access(CREDENTIALS_FILE);
      // If file exists, this is not first-time setup
      return NextResponse.json(
        { error: 'Unauthorized - Not first time setup' },
        { status: 403 }
      );
    } catch {
      // File doesn't exist, proceed with first-time setup

      // Update Unix password
      await execAsync(`echo "darkflows:${password}" | chpasswd`);

      // Update Samba password
      await execAsync(`(echo "${password}"; echo "${password}") | smbpasswd -s -a darkflows`);

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Failed to update system passwords:', error);
    return NextResponse.json({ error: 'Failed to update system passwords' }, { status: 500 });
  }
} 