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
  try {
    return output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [ip, hostnames] = line.split(' -> ')
        return {
          ip,
          hostnames: hostnames ? hostnames.split(', ') : []
        }
      })
  } catch (error) {
    console.error('Error parsing list output:', error)
    return []
  }
}

// GET handler to list all DNS entries
export async function GET() {
  try {
    const { stdout, stderr } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} list`)
    if (stderr) {
      console.error('Script stderr:', stderr)
    }
    const entries = parseListOutput(stdout)
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Error in GET:', error)
    // Return an empty list that won't break the UI
    return NextResponse.json({ entries: [] })
  }
}

// POST handler to add new DNS entries
export async function POST(request: Request) {
  try {
    const { ip, hostname } = await request.json()
    
    if (!ip || !hostname) {
      return NextResponse.json(
        { error: 'IP and hostname are required' },
        { status: 400 }
      )
    }

    await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname}`)
    
    // Re-fetch the updated list
    const { stdout } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} list`)
    const entries = parseListOutput(stdout)
    
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Error in POST:', error)
    return NextResponse.json(
      { error: 'Failed to add DNS entry', entries: [] },
      { status: 500 }
    )
  }
}

// DELETE handler to remove DNS entries
export async function DELETE(request: Request) {
  try {
    const { hostname } = await request.json()
    
    if (!hostname) {
      return NextResponse.json({ error: 'Hostname is required' }, { status: 400 })
    }

    const { stderr } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`)
    if (stderr) {
      console.error('Script stderr:', stderr)
      return NextResponse.json({ error: stderr }, { status: 500 })
    }
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
    const { stdout, stderr } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} list`);
    if (stderr) {
      console.error('Script stderr:', stderr)
    }
    const entries = parseListOutput(stdout);
    
    // Remove all hostnames for this IP
    const ipEntry = entries.find(e => e.ip === ip);
    if (ipEntry) {
      for (const hostname of ipEntry.hostnames) {
        try {
          const { stderr } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`);
          if (stderr) {
            console.error('Script stderr:', stderr)
          }
        } catch (error) {
          console.error('Error removing hostname:', error)
        }
      }
    }
    
    // Add new hostname
    const { stderr: addStderr } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${newHostname}`);
    if (addStderr) {
      console.error('Script stderr:', addStderr)
      return NextResponse.json({ error: addStderr }, { status: 500 })
    }
    
    // If we have a MAC address, update the DHCP reservation too
    if (mac) {
      try {
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
      } catch (error) {
        console.error('Error updating DHCP reservation:', error)
      }
    }
    
    try {
      await syncAllSystems();
    } catch (error) {
      console.error('Error syncing systems:', error)
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating hostname:', error);
    return NextResponse.json({ error: 'Failed to update hostname' }, { status: 500 });
  }
} 