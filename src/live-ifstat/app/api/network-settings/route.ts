import { NextResponse, NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import { requireAuth } from '../../lib/auth'

interface NetworkSettings {
  gatewayIp: string
  subnetMask: string
  ipPools: { start: string; end: string }[]
  cakeDefault?: string
  cakeParams?: string
  // Cloudflare DNS Settings
  zoneId?: string
  recordId?: string
  apiToken?: string
  recordName?: string
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

export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    // Read network interface config
    const interfacesConfig = await fs.readFile('/etc/network/interfaces', 'utf-8')
    const dhcpConfig = await fs.readFile('/etc/kea/kea-dhcp4.conf', 'utf-8')
    const networkConfig = await fs.readFile('/etc/darkflows/d_network.cfg', 'utf-8')

    // Parse gateway IP and subnet mask from interfaces file
    const staticMatch = interfacesConfig.match(/iface\s+\w+\s+inet\s+static\s+address\s+([\d.]+)\s+netmask\s+([\d.]+)/)
    const gatewayIp = staticMatch ? staticMatch[1] : '192.168.1.1'
    const subnetMask = staticMatch ? staticMatch[2] : '255.255.254.0'

    // Parse CAKE_DEFAULT and CAKE_PARAMS from network config
    const cakeDefaultMatch = networkConfig.match(/CAKE_DEFAULT="([^"]*)"/)
    const cakeParamsMatch = networkConfig.match(/CAKE_PARAMS="([^"]*)"/)
    const cakeDefault = cakeDefaultMatch ? cakeDefaultMatch[1] : ''
    const cakeParams = cakeParamsMatch ? cakeParamsMatch[1] : ''

    // Parse Cloudflare DNS settings
    const zoneIdMatch = networkConfig.match(/ZONE_ID="([^"]*)"/)
    const recordIdMatch = networkConfig.match(/RECORD_ID="([^"]*)"/)
    const apiTokenMatch = networkConfig.match(/API_TOKEN="([^"]*)"/)
    const recordNameMatch = networkConfig.match(/RECORD_NAME="([^"]*)"/)
    const zoneId = zoneIdMatch ? zoneIdMatch[1] : ''
    const recordId = recordIdMatch ? recordIdMatch[1] : ''
    const apiToken = apiTokenMatch ? apiTokenMatch[1] : ''
    const recordName = recordNameMatch ? recordNameMatch[1] : ''

    // Parse IP pools from DHCP config
    const dhcpJson = JSON.parse(dhcpConfig)
    const pools = dhcpJson.Dhcp4.subnet4[0].pools.map((pool: DhcpPool) => {
      const [start, end] = pool.pool.split('-')
      return { start: start.trim(), end: end.trim() }
    })

    return NextResponse.json({ 
      gatewayIp, 
      subnetMask, 
      ipPools: pools, 
      cakeDefault,
      cakeParams,
      zoneId,
      recordId,
      apiToken,
      recordName
    })
  } catch (error) {
    console.error('Error reading network settings:', error)
    return NextResponse.json({ error: 'Failed to read network settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse
  
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
    let networkConfig = await fs.readFile('/etc/darkflows/d_network.cfg', 'utf-8')

    // Update interfaces file - match any interface name with static configuration
    interfacesConfig = interfacesConfig.replace(
      /(iface\s+\w+\s+inet\s+static\s+address)\s+[\d.]+\s+netmask\s+[\d.]+/,
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

    // Update CAKE_PARAMS in network config
    if (settings.cakeParams !== undefined) {
      networkConfig = networkConfig.replace(
        /CAKE_PARAMS="[^"]*"/,
        `CAKE_PARAMS="${settings.cakeParams}"`
      )
    }

    // Update CAKE_DEFAULT in network config
    if (settings.cakeDefault) {
      networkConfig = networkConfig.replace(
        /CAKE_DEFAULT="[^"]*"/,
        `CAKE_DEFAULT="${settings.cakeDefault}"`
      )
    }

    // Update Cloudflare DNS settings in network config
    if (settings.zoneId !== undefined) {
      networkConfig = networkConfig.replace(
        /ZONE_ID="[^"]*"/,
        `ZONE_ID="${settings.zoneId}"`
      )
    }

    if (settings.recordId !== undefined) {
      networkConfig = networkConfig.replace(
        /RECORD_ID="[^"]*"/,
        `RECORD_ID="${settings.recordId}"`
      )
    }

    if (settings.apiToken !== undefined) {
      networkConfig = networkConfig.replace(
        /API_TOKEN="[^"]*"/,
        `API_TOKEN="${settings.apiToken}"`
      )
    }

    if (settings.recordName !== undefined) {
      networkConfig = networkConfig.replace(
        /RECORD_NAME="[^"]*"/,
        `RECORD_NAME="${settings.recordName}"`
      )
    }

    // Write updated configs
    await fs.writeFile('/etc/network/interfaces', interfacesConfig)
    await fs.writeFile('/etc/kea/kea-dhcp4.conf', JSON.stringify(dhcpJson, null, 2))
    await fs.writeFile('/etc/darkflows/d_network.cfg', networkConfig, 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating network settings:', error)
    return NextResponse.json({ error: 'Failed to update network settings' }, { status: 500 })
  }
} 