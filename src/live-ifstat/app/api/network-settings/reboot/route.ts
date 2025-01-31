import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    await execAsync('/usr/local/darkflows/bin/reboot_server.sh');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error rebooting server:', error);
    return NextResponse.json(
      { error: 'Failed to reboot server' },
      { status: 500 }
    );
  }
} 