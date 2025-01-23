import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

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