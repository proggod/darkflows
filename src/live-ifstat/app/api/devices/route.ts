'use server'

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'

interface NetworkDevice {
  type?: 'primary' | 'secondary' | 'internal'
  label?: string
  egressBandwidth?: string
  ingressBandwidth?: string
  name?: string
}

async function parseNetworkConfig(): Promise<Record<string, NetworkDevice>> {
  try {
    const content = await readFile('/etc/darkflows/d_network.cfg', 'utf-8')
    const devices: Record<string, NetworkDevice> = {}
    
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed) continue

      const match = trimmed.match(/^(\w+)_(\w+)="([^"]*)"/)
      if (!match) continue

      const [, type, key, value] = match
      const deviceType = type.toLowerCase() as 'primary' | 'secondary' | 'internal'

      if (key === 'INTERFACE') {
        if (value.trim() === '') continue
        
        devices[value] = {
          type: deviceType,
          name: value
        }
      } else if (key === 'LABEL' && devices[getInterfaceForType(lines, deviceType)]) {
        const iface = getInterfaceForType(lines, deviceType)
        if (iface && devices[iface]) {
          devices[iface].label = value
        }
      } else if (key.endsWith('BANDWIDTH')) {
        const direction = key.startsWith('EGRESS') ? 'egressBandwidth' : 'ingressBandwidth'
        const iface = getInterfaceForType(lines, deviceType)
        if (iface && devices[iface]) {
          devices[iface][direction] = value
        }
      }
    }
    
    return devices
  } catch (error) {
    console.error('Error reading network config:', error)
    return {}
  }
}

function getInterfaceForType(lines: string[], type: string): string {
  const interfaceLine = lines.find(line => 
    line.trim().startsWith(`${type.toUpperCase()}_INTERFACE=`)
  )
  if (!interfaceLine) return ''
  
  const match = interfaceLine.match(/"([^"]*)"/)
  return match ? match[1] : ''
}

export async function GET() {
  try {
    const configDevices = await parseNetworkConfig()
    
    // Convert the devices object into an array
    const deviceArray = Object.entries(configDevices).map(([name, device]) => ({
      name,
      type: device.type,
      label: device.label,
      egressBandwidth: device.egressBandwidth,
      ingressBandwidth: device.ingressBandwidth
    }));


    return NextResponse.json({
      devices: deviceArray
    })
  } catch (error) {
    console.error('Error fetching devices:', error)
    return NextResponse.json({ 
      devices: [] 
    })
  }
} 