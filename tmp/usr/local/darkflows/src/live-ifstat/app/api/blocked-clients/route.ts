import { NextResponse } from 'next/server';
import fs from 'fs/promises';

const BLOCKED_CLIENTS_FILE = '/etc/darkflows/blocked_clients.txt';

async function readBlockedClients(): Promise<string[]> {
  try {
    const content = await fs.readFile(BLOCKED_CLIENTS_FILE, 'utf-8');
    return content.split('\n').filter(line => line.trim() !== '');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(BLOCKED_CLIENTS_FILE, '', 'utf-8');
      return [];
    }
    throw error;
  }
}

async function writeBlockedClients(macs: string[]): Promise<void> {
  await fs.writeFile(BLOCKED_CLIENTS_FILE, macs.join('\n'), 'utf-8');
}

export async function GET() {
  try {
    const blockedMacs = await readBlockedClients();
    return NextResponse.json({ blockedMacs });
  } catch (error) {
    console.error('Error reading blocked clients:', error);
    return NextResponse.json(
      { error: 'Failed to read blocked clients' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { mac } = await request.json();
    if (!mac) {
      return NextResponse.json(
        { error: 'MAC address is required' },
        { status: 400 }
      );
    }

    const blockedMacs = await readBlockedClients();
    if (!blockedMacs.includes(mac)) {
      blockedMacs.push(mac);
      await writeBlockedClients(blockedMacs);
    }

    return NextResponse.json({ blockedMacs });
  } catch (error) {
    console.error('Error blocking client:', error);
    return NextResponse.json(
      { error: 'Failed to block client' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { mac } = await request.json();
    if (!mac) {
      return NextResponse.json(
        { error: 'MAC address is required' },
        { status: 400 }
      );
    }

    const blockedMacs = await readBlockedClients();
    const index = blockedMacs.indexOf(mac);
    if (index !== -1) {
      blockedMacs.splice(index, 1);
      await writeBlockedClients(blockedMacs);
    }

    return NextResponse.json({ blockedMacs });
  } catch (error) {
    console.error('Error unblocking client:', error);
    return NextResponse.json(
      { error: 'Failed to unblock client' },
      { status: 500 }
    );
  }
} 