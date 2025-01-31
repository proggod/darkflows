import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { requireAuth } from '../../lib/auth'

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
  PRIMARY_LABEL: string
  SECONDARY_LABEL: string
  PRIMARY_INTERFACE: string
  SECONDARY_INTERFACE: string
  INTERNAL_INTERFACE: string
  CAKE_PARAMS: string
  CAKE_DEFAULT: string
  [key: string]: BandwidthValue | string
}

async function parseConfig(): Promise<NetworkConfig> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config: NetworkConfig = {
      PRIMARY_EGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
      PRIMARY_INGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
      SECONDARY_EGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
      SECONDARY_INGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
      PRIMARY_LABEL: '',
      SECONDARY_LABEL: '',
      PRIMARY_INTERFACE: '',
      SECONDARY_INTERFACE: '',
      INTERNAL_INTERFACE: '',
      CAKE_PARAMS: '',
      CAKE_DEFAULT: '',
    }

    const lines = content.split('\n')
    for (const line of lines) {
      // Parse interface settings
      const interfaceMatch = line.match(/^(\w+)_INTERFACE="([^"]*)"/)
      if (interfaceMatch) {
        const [, type, value] = interfaceMatch
        const key = `${type}_INTERFACE`
        config[key] = value
        continue
      }

      const bandwidthMatch = line.match(/^(\w+)_(\w+)_BANDWIDTH="([^"]*)"/)
      if (bandwidthMatch) {
        const [, type, direction, value] = bandwidthMatch
        const key = `${type}_${direction}_BANDWIDTH`
        const [numValue, unit = 'mbit'] = value.split(/(?<=\d)(?=[a-z])/i)
        config[key] = { value: numValue, unit: unit.toLowerCase() }
        continue
      }

      const labelMatch = line.match(/^(\w+)_LABEL="([^"]*)"/)
      if (labelMatch) {
        const [, type, value] = labelMatch
        const key = `${type}_LABEL`
        config[key] = value
        continue
      }

      const cakeMatch = line.match(/^CAKE_PARAMS="([^"]*)"/)
      if (cakeMatch) {
        config.CAKE_PARAMS = cakeMatch[1]
      }

      const cakeDefaultMatch = line.match(/^CAKE_DEFAULT="([^"]*)"/)
      if (cakeDefaultMatch) {
        config.CAKE_DEFAULT = cakeDefaultMatch[1]
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
      const bandwidthMatch = line.match(/^(\w+)_(\w+)_BANDWIDTH="([^"]*)"/)
      if (bandwidthMatch) {
        const [, type, direction] = bandwidthMatch
        const key = `${type}_${direction}_BANDWIDTH`
        if (config[key] && typeof config[key] !== 'string') {
          return `${key}="${config[key].value}${config[key].unit}"`
        }
      }

      // Check if line is a label setting
      const labelMatch = line.match(/^(\w+)_LABEL="([^"]*)"/)
      if (labelMatch) {
        const [, type] = labelMatch
        const key = `${type}_LABEL`
        if (config[key]) {
          return `${key}="${config[key]}"`
        }
      }

      // Check if line is CAKE_PARAMS
      const cakeMatch = line.match(/^CAKE_PARAMS="([^"]*)"/)
      if (cakeMatch) {
        return `CAKE_PARAMS="${config.CAKE_PARAMS}"`
      }

      // Check if line is CAKE_DEFAULT
      const cakeDefaultMatch = line.match(/^CAKE_DEFAULT="([^"]*)"/)
      if (cakeDefaultMatch) {
        return `CAKE_DEFAULT="${config.CAKE_DEFAULT}"`
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
  // Check authentication first
  const authResponse = await requireAuth();
  if (authResponse) return authResponse;

  try {
    const config = await parseConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error reading network config:', error);
    return NextResponse.json({ 
      error: 'Failed to read network config',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Check authentication first
  const authResponse = await requireAuth();
  if (authResponse) return authResponse;

  try {
    const config = await request.json()
    await writeConfig(config)
    return NextResponse.json({ message: 'Configuration updated successfully' })
  } catch (error) {
    console.error('Error in POST /api/network-config:', error)
    return NextResponse.json({
      error: 'Failed to update configuration. Please check file permissions and try again.'
    }, { status: 500 })
  }
} 