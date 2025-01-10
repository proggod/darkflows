import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { exec } from 'child_process';

const KEA_CONFIG_PATH = '/etc/kea/kea-dhcp4.conf';

interface KeaReservation {
  'ip-address': string;
  'hw-address': string;
  hostname?: string;
}

interface KeaConfig {
  Dhcp4: {
    subnet4: [{
      reservations: KeaReservation[];
    }];
  };
}

async function readConfig() {
  try {
    const content = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
    // Remove any trailing commas before parsing
    const cleanContent = content
      .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas before } or ]
      .replace(/,(\s*})/g, '}')       // Remove trailing commas before }
      .replace(/,(\s*\])/g, ']');     // Remove trailing commas before ]
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error parsing Kea config:', error);
    throw error;
  }
}

async function writeConfig(config: KeaConfig) {
  // Remove duplicates before writing
  const seen = new Set<string>();
  config.Dhcp4.subnet4[0].reservations = config.Dhcp4.subnet4[0].reservations.filter((r: KeaReservation) => {
    const key = `${r['ip-address']}-${r['hw-address'].toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await fs.writeFile(KEA_CONFIG_PATH, JSON.stringify(config, null, 2));
  try {
    await new Promise((resolve, reject) => {
      exec('sudo systemctl reload kea-dhcp4-server', (error: Error | null) => {
        if (error) {
          console.warn('Could not reload Kea configuration:', error);
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.warn('Could not reload Kea configuration:', error);
  }
}

export async function GET() {
  try {
    const config = await readConfig();
    const reservations = config.Dhcp4.subnet4[0].reservations;
    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error reading reservations:', error);
    return NextResponse.json({ error: 'Failed to read reservations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const reservation = await request.json();
    const config = await readConfig();
    
    // Check if reservation with same IP or MAC already exists
    const isDuplicate = config.Dhcp4.subnet4[0].reservations.some((r: KeaReservation) => 
      r['ip-address'] === reservation['ip-address'] || 
      r['hw-address'].toLowerCase() === reservation['hw-address'].toLowerCase()
    );
    
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Reservation with this IP or MAC address already exists' }, 
        { status: 409 }
      );
    }
    
    // Add new reservation
    config.Dhcp4.subnet4[0].reservations.push(reservation);
    
    await writeConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding reservation:', error);
    return NextResponse.json({ error: 'Failed to add reservation' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { ip, mac } = await request.json();
    const config = await readConfig();
    
    config.Dhcp4.subnet4[0].reservations = config.Dhcp4.subnet4[0].reservations
      .filter((r: KeaReservation) => r['ip-address'] !== ip && r['hw-address'] !== mac);
    
    await writeConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  }
} 