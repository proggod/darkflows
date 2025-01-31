import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { requireAuth } from '../../lib/auth'

const execAsync = promisify(exec)
const ROUTES_FILE = '/etc/darkflows/route_to_secondary.txt'
const UPDATE_SCRIPT = '/usr/local/darkflows/bin/update_secondary_routes.sh'
const CONFIG_FILE = '/etc/darkflows/d_network.cfg'

interface NetworkInfo {
  address: string
  netmask: string
}

// Helper to parse config file
async function getInternalInterface(): Promise<string> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8')
    const match = content.match(/INTERNAL_INTERFACE="([^"]+)"/)
    if (!match) {
      throw new Error('Internal interface not found in config')
    }
    return match[1]
  } catch (error) {
    console.error('Error reading config file:', error)
    throw error
  }
}

// Helper to get interface IP info
async function getInterfaceInfo(iface: string): Promise<NetworkInfo> {
  try {
    const { stdout } = await execAsync(`ip addr show ${iface}`)
    const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/)
    if (!match) {
      throw new Error(`No IPv4 address found for interface ${iface}`)
    }
    
    // Convert CIDR to netmask
    const cidr = parseInt(match[2])
    const netmask = Array(4).fill(0)
      .map((_, i) => Math.max(0, Math.min(255, 256 - (256 >> Math.min(8, Math.max(0, cidr - i * 8))))))
      .join('.')
    
    return {
      address: match[1],
      netmask: netmask
    }
  } catch (error) {
    console.error('Error getting interface info:', error)
    throw error
  }
}

// Helper to check if IP is in network
function isIpInNetwork(ip: string, networkIp: string, netmask: string): boolean {
  const ipParts = ip.split('.').map(Number)
  const networkParts = networkIp.split('.').map(Number)
  const maskParts = netmask.split('.').map(Number)
  
  return ipParts.every((part, i) => 
    (part & maskParts[i]) === (networkParts[i] & maskParts[i])
  )
}

// Helper to ensure directory exists
async function ensureDir(filePath: string) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

// Helper to read routes
async function readRoutes(): Promise<string[]> {
  try {
    await fs.access(ROUTES_FILE)
    const content = await fs.readFile(ROUTES_FILE, 'utf-8')
    return content.split('\n').filter(line => line.trim())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await ensureDir(ROUTES_FILE)
      await fs.writeFile(ROUTES_FILE, '', { mode: 0o644 })
      return []
    }
    throw error
  }
}

// Helper to write routes
async function writeRoutes(routes: string[]): Promise<void> {
  await ensureDir(ROUTES_FILE)
  await fs.writeFile(ROUTES_FILE, routes.join('\n') + '\n', { mode: 0o644 })
}

// Helper to update routes
async function updateRoutes(): Promise<void> {
  try {
    const { stderr } = await execAsync(`${UPDATE_SCRIPT}`)
    if (stderr) {
      console.error('Script stderr:', stderr)
      throw new Error(`Update script error: ${stderr}`)
    }
  } catch (error) {
    console.error('Error updating routes:', error)
    throw error instanceof Error ? error : new Error('Failed to update routes')
  }
}

// GET handler
export async function GET() {
  // Check authentication first
  const authResponse = await requireAuth();
  if (authResponse) return authResponse;

  try {
    const routes = await readRoutes();
    return NextResponse.json({ routes });
  } catch (error) {
    console.error('Error reading routes:', error);
    return NextResponse.json(
      { error: 'Failed to read routes' },
      { status: 500 }
    );
  }
}

// POST handler
export async function POST(request: Request) {
  // Check authentication first
  const authResponse = await requireAuth()
  if (authResponse) return authResponse

  try {
    const { ip } = await request.json()
    
    if (!ip || typeof ip !== 'string') {
      return NextResponse.json(
        { error: 'Invalid IP address' },
        { status: 400 }
      )
    }

    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ip)) {
      return NextResponse.json(
        { error: 'Invalid IP address format' },
        { status: 400 }
      )
    }

    // Validate IP address values
    const parts = ip.split('.').map(Number)
    if (parts.some(part => part < 0 || part > 255)) {
      return NextResponse.json(
        { error: 'IP address values must be between 0 and 255' },
        { status: 400 }
      )
    }

    // Validate IP is in internal network
    const internalIface = await getInternalInterface()
    const networkInfo = await getInterfaceInfo(internalIface)
    if (!isIpInNetwork(ip, networkInfo.address, networkInfo.netmask)) {
      return NextResponse.json(
        { error: 'IP address must be in the internal network range' },
        { status: 400 }
      )
    }

    const routes = await readRoutes()
    if (routes.includes(ip)) {
      return NextResponse.json(
        { error: 'IP already exists' },
        { status: 400 }
      )
    }

    routes.push(ip)
    await writeRoutes(routes)
    await updateRoutes()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating routes:', error)
    return NextResponse.json(
      { error: 'Failed to update routes' },
      { status: 500 }
    )
  }
}

// DELETE handler
export async function DELETE(request: Request) {
  // Add authentication check
  const authResponse = await requireAuth();
  if (authResponse) return authResponse;

  try {
    const { ip } = await request.json();
    
    if (!ip || typeof ip !== 'string') {
      return NextResponse.json(
        { error: 'Invalid IP address' },
        { status: 400 }
      )
    }

    const routes = await readRoutes()
    const newRoutes = routes.filter(route => route !== ip)
    
    if (routes.length === newRoutes.length) {
      return NextResponse.json(
        { error: 'IP not found' },
        { status: 404 }
      )
    }

    await writeRoutes(newRoutes)
    await updateRoutes()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete route'
    return NextResponse.json({ error: message }, { status: 500 })
  }
} 