import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readConfig, writeConfig } from '@/lib/config'
import { syncAllSystems } from '@/lib/sync'

const execAsync = promisify(exec)
const DNS_MANAGER_SCRIPT = '/usr/local/darkflows/bin/pihole-dns-manager.py'

interface DnsEntry {
  ip: string
  hostnames: string[]
}

// Helper to parse the list output into structured data
function parseListOutput(output: string): DnsEntry[] {
  return output.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [ip, hostnames] = line.split(' -> ')
      return {
        ip,
        hostnames: hostnames.split(', ')
      }
    })
}

// GET handler to list all DNS entries
export async function GET() {
  try {
    const { stdout } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} list`)
    const entries = parseListOutput(stdout)
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Error in GET:', error)
    const message = error instanceof Error ? error.message : 'Failed to list DNS entries'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST handler to add new DNS entries
export async function POST(request: Request) {
  try {
    const { ip, hostname } = await request.json()
    
    if (!ip || !hostname) {
      return NextResponse.json({ error: 'IP and hostname are required' }, { status: 400 })
    }

    await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST:', error)
    const message = error instanceof Error ? error.message : 'Failed to add DNS entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE handler to remove DNS entries
export async function DELETE(request: Request) {
  try {
    const { hostname } = await request.json()
    
    if (!hostname) {
      return NextResponse.json({ error: 'Hostname is required' }, { status: 400 })
    }

    await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE:', error)
    const message = error instanceof Error ? error.message : 'Failed to remove DNS entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { ip, newHostname, mac } = await request.json();
    
    // Get current DNS entries to check for duplicates
    const { stdout } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} list`);
    const entries = parseListOutput(stdout);
    
    // Remove all hostnames for this IP
    const ipEntry = entries.find(e => e.ip === ip);
    if (ipEntry) {
      for (const hostname of ipEntry.hostnames) {
        await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`);
      }
    }
    
    // Add new hostname
    await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${newHostname}`);
    
    // If we have a MAC address, update the DHCP reservation too
    if (mac) {
      const config = await readConfig();
      const reservations = config.Dhcp4.subnet4[0].reservations;
      
      // Find and update the matching reservation
      const reservation = reservations.find(r => 
        r['ip-address'] === ip && r['hw-address'] === mac
      );
      
      if (reservation) {
        reservation.hostname = newHostname;
        await writeConfig(config);
      }
    }
    
    await syncAllSystems();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating hostname:', error);
    return NextResponse.json({ error: 'Failed to update hostname' }, { status: 500 });
  }
} 