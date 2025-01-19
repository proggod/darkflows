import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const CONFIG_PATH = '/etc/darkflows/d_network.cfg'

interface BandwidthValue {
  value: string
  unit: string
}

interface NetworkConfig {
  PRIMARY_EGRESS_BANDWIDTH: BandwidthValue
  PRIMARY_INGRESS_BANDWIDTH: BandwidthValue
  SECONDARY_EGRESS_BANDWIDTH: BandwidthValue
  SECONDARY_INGRESS_BANDWIDTH: BandwidthValue
  [key: string]: BandwidthValue
}

async function parseConfig(): Promise<NetworkConfig> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config: NetworkConfig = {
      PRIMARY_EGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
      PRIMARY_INGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
      SECONDARY_EGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
      SECONDARY_INGRESS_BANDWIDTH: { value: '', unit: 'mbit' }
    }

    const lines = content.split('\n')
    for (const line of lines) {
      const match = line.match(/^(\w+)_(\w+)_BANDWIDTH="([^"]*)"/)
      if (match) {
        const [, type, direction, value] = match
        const key = `${type}_${direction}_BANDWIDTH`
        const [numValue, unit = 'mbit'] = value.split(/(?<=\d)(?=[a-z])/i)
        config[key] = { value: numValue, unit: unit.toLowerCase() }
      }
    }

    return config
  } catch (error) {
    console.error('Error reading network config:', error)
    throw error
  }
}

async function writeConfig(config: NetworkConfig): Promise<void> {
  try {
    // Read existing content first
    const existingContent = await readFile(CONFIG_PATH, 'utf-8')
    const lines = existingContent.split('\n')
    const updatedLines = lines.map(line => {
      // Skip empty lines or comments
      if (!line.trim() || line.trim().startsWith('#')) {
        return line
      }

      // Check if line is a bandwidth setting
      const match = line.match(/^(\w+)_(\w+)_BANDWIDTH="([^"]*)"/)
      if (match) {
        const [, type, direction] = match
        const key = `${type}_${direction}_BANDWIDTH`
        if (config[key]) {
          return `${key}="${config[key].value}${config[key].unit}"`
        }
      }
      return line
    })
    
    await writeFile(CONFIG_PATH, updatedLines.join('\n'), 'utf-8')
    
    // Run the changebw.sh script after updating config
    await execAsync('/usr/local/darkflows/bin/changebw.sh')
  } catch (error) {
    console.error('Error writing network config:', error)
    throw error
  }
}

export async function GET() {
  try {
    const config = await parseConfig()
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error in GET /api/network-config:', error)
    return NextResponse.json(
      { error: 'Failed to read network configuration' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const config = await request.json()
    await writeConfig(config)
    return NextResponse.json({ message: 'Configuration updated successfully' })
  } catch (error) {
    console.error('Error in POST /api/network-config:', error)
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
} 