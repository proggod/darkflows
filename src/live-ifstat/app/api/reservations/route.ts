import { NextResponse, NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readConfig, writeConfig, type KeaReservation } from '@/lib/config';
import { syncAllSystems } from '@/lib/sync';
import { requireAuth } from '../../lib/auth';

// At the top of the file, after imports
process.stdout.write('=== Reservations API module loaded ===\n');

const execAsync = promisify(exec);
const DNS_MANAGER_SCRIPT = '/usr/local/darkflows/bin/pihole-dns-manager.py';

async function syncDNSEntry(ip: string, hostname: string, shouldDelete = false) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] DNS Sync:`;

  try {
    const cmd = shouldDelete 
      ? `python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`
      : `python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname}`;
    
    process.stdout.write(`${prefix} Executing command: ${cmd}\n`);
    
    const { stdout, stderr } = shouldDelete
      ? await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`)
      : await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname}`);

    if (stdout) process.stdout.write(`${prefix} Output: ${stdout}\n`);
    if (stderr) process.stderr.write(`${prefix} Error: ${stderr}\n`);
    
    process.stdout.write(`${prefix} Command executed successfully\n`);
  } catch (error) {
    process.stderr.write(`${prefix} Failed: ${error}\n`);
  }
}

export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  try {
    const config = await readConfig();
    const reservations = config?.Dhcp4?.subnet4?.[0]?.reservations || [];
    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error reading reservations:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  try {
    const reservation = await request.json();
    const config = await readConfig();
    
    // Ensure the config structure exists
    if (!config.Dhcp4?.subnet4?.[0]?.reservations) {
      config.Dhcp4 = config.Dhcp4 || {};
      config.Dhcp4.subnet4 = config.Dhcp4.subnet4 || [{}];
      config.Dhcp4.subnet4[0].reservations = [];
    }
    
    // Add the new reservation
    config.Dhcp4.subnet4[0].reservations.push(reservation);
    
    // Write the updated config
    await writeConfig(config);
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  try {
    const { ip, mac } = await request.json();
    const config = await readConfig();
    
    // Find the reservation before deleting to get hostname
    const reservation = config.Dhcp4.subnet4[0].reservations
      .find((r: KeaReservation) => r['ip-address'] === ip && r['hw-address'] === mac);

    if (reservation?.hostname) {
      await syncDNSEntry(ip, reservation.hostname, true);
    }
    
    config.Dhcp4.subnet4[0].reservations = config.Dhcp4.subnet4[0].reservations
      .filter((r: KeaReservation) => r['ip-address'] !== ip && r['hw-address'] !== mac);
    
    await writeConfig(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  try {
    const { originalIp, ...reservation } = await request.json();
    const config = await readConfig();
    
    // Find existing reservation using only MAC address
    const existing = config.Dhcp4.subnet4[0].reservations.find(r => 
      r['hw-address'] === reservation['hw-address']
    );

    if (!existing) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // If IP address changed and we have a hostname, update DNS
    if (originalIp !== reservation['ip-address'] && existing.hostname) {
      // Remove old DNS entry
      await syncDNSEntry(originalIp, existing.hostname, true);
      // Add new DNS entry
      await syncDNSEntry(reservation['ip-address'], existing.hostname);
    }

    // Update the reservation with new values
    Object.assign(existing, reservation);
    
    await writeConfig(config);
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  }
} 