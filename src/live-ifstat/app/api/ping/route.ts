import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { ip } = await request.json();

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    // Use ping command with a short timeout
    const { stdout, stderr } = await execAsync(`ping -c 1 -W 1 ${ip}`);
    const alive = !stderr && stdout.includes('1 received');

    return NextResponse.json({ alive });
  } catch {
    // If ping fails, the IP is considered not in use
    return NextResponse.json({ alive: false });
  }
} 