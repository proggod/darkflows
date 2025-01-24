import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface NetworkSettings {
  gatewayIp: string
  subnetMask: string
  ipPools: { start: string; end: string }[]
}

interface DhcpPool {
  pool: string
}

function calculateNetworkAddress(ip: string, mask: string): string {
  const ipParts = ip.split('.').map(Number)
  const maskParts = mask.split('.').map(Number)
  const networkParts = ipParts.map((part, i) => part & maskParts[i])
  return networkParts.join('.')
}

function calculateCidr(mask: string): number {
  return mask.split('.')
    .map(part => parseInt(part))
    .map(n => n.toString(2).padStart(8, '0'))
    .join('')
    .split('1')
    .length - 1
}

export async function GET() {
  try {
    // Read network interface config
    const interfacesConfig = await fs.readFile('/etc/network/interfaces', 'utf-8')
    const dhcpConfig = await fs.readFile('/etc/kea/kea-dhcp4.conf', 'utf-8')

    // Parse gateway IP and subnet mask from interfaces file
    const staticMatch = interfacesConfig.match(/iface enp2s0 inet static\s+address ([\d.]+)\s+netmask ([\d.]+)/)
    const gatewayIp = staticMatch ? staticMatch[1] : '192.168.1.1'
    const subnetMask = staticMatch ? staticMatch[2] : '255.255.254.0'

    // Parse IP pools from DHCP config
    const dhcpJson = JSON.parse(dhcpConfig)
    const pools = dhcpJson.Dhcp4.subnet4[0].pools.map((pool: DhcpPool) => {
      const [start, end] = pool.pool.split('-')
      return { start: start.trim(), end: end.trim() }
    })

    return NextResponse.json({ gatewayIp, subnetMask, ipPools: pools })
  } catch (error) {
    console.error('Error reading network settings:', error)
    return NextResponse.json({ error: 'Failed to read network settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const settings: NetworkSettings = await request.json()

    // Validate IP addresses and subnet mask
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(settings.gatewayIp) || !ipRegex.test(settings.subnetMask)) {
      return NextResponse.json({ error: 'Invalid IP address or subnet mask format' }, { status: 400 })
    }

    // Read current configs
    let interfacesConfig = await fs.readFile('/etc/network/interfaces', 'utf-8')
    const dhcpConfig = await fs.readFile('/etc/kea/kea-dhcp4.conf', 'utf-8')

    // Update interfaces file
    interfacesConfig = interfacesConfig.replace(
      /(iface enp2s0 inet static\s+address) [\d.]+ *\n *netmask [\d.]+/,
      `$1 ${settings.gatewayIp}\n  netmask ${settings.subnetMask}`
    )

    // Update DHCP config
    const dhcpJson = JSON.parse(dhcpConfig)

    // Calculate network address and CIDR
    const networkAddress = calculateNetworkAddress(settings.gatewayIp, settings.subnetMask)
    const cidr = calculateCidr(settings.subnetMask)

    // Update subnet in DHCP config with network address
    dhcpJson.Dhcp4.subnet4[0].subnet = `${networkAddress}/${cidr}`

    // Update pools in DHCP config
    dhcpJson.Dhcp4.subnet4[0].pools = settings.ipPools.map(pool => ({
      pool: `${pool.start}-${pool.end}`
    }))

    // Update routers and DNS servers in DHCP config
    dhcpJson.Dhcp4.subnet4[0]['option-data'] = [
      {
        name: 'routers',
        data: settings.gatewayIp
      },
      {
        name: 'domain-name-servers',
        data: settings.gatewayIp
      }
    ]

    // Write updated configs
    await fs.writeFile('/etc/network/interfaces', interfacesConfig)
    await fs.writeFile('/etc/kea/kea-dhcp4.conf', JSON.stringify(dhcpJson, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating network settings:', error)
    return NextResponse.json({ error: 'Failed to update network settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const { service } = await request.json()
  
  try {
    if (service === 'network') {
      await execAsync('systemctl restart networking')
    } else if (service === 'dhcp') {
      await execAsync('systemctl restart kea-dhcp4-server')
    } else {
      throw new Error('Invalid service specified')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error restarting ${service} service:`, error)
    return NextResponse.json({ error: `Failed to restart ${service} service` }, { status: 500 })
  }
} 