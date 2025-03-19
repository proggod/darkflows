import { NextResponse, NextRequest } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { syncAllSystems } from '@/lib/sync'
import { getDbConnection } from '@/lib/db'

const execAsync = promisify(exec)
const DNS_MANAGER_SCRIPT = '/usr/local/darkflows/bin/unbound-dns-manager.py'

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
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subnetId = searchParams.get('subnetId') || '1';
    
    const command = `python3 ${DNS_MANAGER_SCRIPT} list ${subnetId}`;
    console.log('Executing DNS command:', command);
    
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.error('Script stderr:', stderr)
      return NextResponse.json({ error: stderr }, { status: 500 })
    }
    
    const entries = parseListOutput(stdout)
    return NextResponse.json({ entries }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error in GET:', error)
    const message = error instanceof Error ? error.message : 'Failed to list DNS entries'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST handler to add new DNS entries
export async function POST(request: NextRequest) {
  try {
    const { ip, hostname, subnetId } = await request.json()
    
    if (!ip || !hostname) {
      return NextResponse.json(
        { error: 'IP and hostname are required' },
        { status: 400 }
      )
    }

    const addCommand = `python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname} ${subnetId || '1'}`;
    console.log('Executing DNS command:', addCommand);
    await execAsync(addCommand)
    
    // Re-fetch the updated list
    const listCommand = `python3 ${DNS_MANAGER_SCRIPT} list ${subnetId || '1'}`;
    console.log('Executing DNS command:', listCommand);
    const { stdout } = await execAsync(listCommand)
    const entries = parseListOutput(stdout)
    
    return NextResponse.json({ entries }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error in POST:', error)
    return NextResponse.json(
      { error: 'Failed to add DNS entry', entries: [] },
      { status: 500 }
    )
  }
}

// DELETE handler to remove DNS entries
export async function DELETE(request: NextRequest) {
  try {
    const { hostname, subnetId } = await request.json()
    
    if (!hostname) {
      return NextResponse.json({ error: 'Hostname is required' }, { status: 400 })
    }

    const command = `python3 ${DNS_MANAGER_SCRIPT} remove ${hostname} ${subnetId || '1'}`;
    console.log('Executing DNS command:', command);
    const { stderr } = await execAsync(command)
    if (stderr) {
      console.error('Script stderr:', stderr)
      return NextResponse.json({ error: stderr }, { status: 500 })
    }
    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error in DELETE:', error)
    const message = error instanceof Error ? error.message : 'Failed to remove DNS entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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
    
    // If we have a MAC address, update the DHCP reservation in the database
    if (mac) {
      try {
        // Convert MAC to binary format for database
        const macHex = mac.replace(/:/g, '');
        const ipNumber = ip.split('.').reduce((acc: number, octet: string) => (acc << 8) + parseInt(octet, 10), 0);
        
        const connection = await getDbConnection();
        
        try {
          await connection.execute(
            'UPDATE hosts SET hostname = ? WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = 1 AND ipv4_address = ?',
            [newHostname, macHex, ipNumber]
          );
        } finally {
          await connection.end();
        }
      } catch (error) {
        console.error('Error updating hostname in database:', error);
        return NextResponse.json({ error: 'Failed to update hostname in database' }, { status: 500 });
      }
    }
    
    try {
      await syncAllSystems();
    } catch (error) {
      console.error('Error syncing systems:', error);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DNS hosts update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 