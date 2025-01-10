import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import { exec } from 'child_process'
import util from 'util'

const execAsync = util.promisify(exec)
const CONFIG_PATH = '/etc/darkflows/d_network.cfg'
const UPDATE_SCRIPT = '/usr/local/darkflows/bin/update_cake.sh'

interface BandwidthValue {
  value: string;
  unit: string;
}

interface NetworkConfig {
  PRIMARY_EGRESS_BANDWIDTH: BandwidthValue;
  PRIMARY_INGRESS_BANDWIDTH: BandwidthValue;
  SECONDARY_EGRESS_BANDWIDTH: BandwidthValue;
  SECONDARY_INGRESS_BANDWIDTH: BandwidthValue;
  [key: string]: BandwidthValue | string;
}

export async function GET() {
  try {
    const config = await fs.readFile(CONFIG_PATH, 'utf-8')
    console.log('Raw config file contents:', config)
    
    const parsedConfig = config.split('\n').reduce((acc: NetworkConfig, line, index) => {
      console.log(`Processing line ${index + 1}:`, line)
      
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) {
        console.log('Skipping comment or empty line')
        return acc
      }
      
      const match = line.match(/^(\w+)="([^"]*)"/)
      if (match) {
        const [, key, value] = match
        console.log('Matched key-value pair:', { key, value })
        
        // Parse bandwidth values with units
        if (key.includes('BANDWIDTH')) {
          const bandwidthMatch = value.match(/^([\d.]+)(Mbit|gbit)$/i)
          if (bandwidthMatch) {
            const [, numValue, unit] = bandwidthMatch
            acc[key] = { value: numValue, unit: unit.toLowerCase() }
            console.log('Processed bandwidth value:', { key, value: numValue, unit })
          } else {
            acc[key] = { value: value, unit: 'Mbit' } // default to Mbit if no unit specified
            console.log('Processed bandwidth value (no unit):', { key, value, unit: 'Mbit' })
          }
        } else {
          acc[key] = value
          console.log('Stored non-bandwidth value:', { key, value })
        }
      } else {
        console.log('No match found for line')
      }
      return acc
    }, {} as NetworkConfig)
    
    console.log('Final parsed config:', parsedConfig)
    return NextResponse.json(parsedConfig)
  } catch (error) {
    console.error('Config read error:', error);
    return NextResponse.json({ error: 'Failed to read config', details: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  console.log('POST /api/network-config started')
  try {
    const data = await request.json()
    console.log('Received config data:', data)
    
    // Read existing config to preserve comments and other settings
    console.log('Reading existing config from:', CONFIG_PATH)
    const existingConfig = await fs.readFile(CONFIG_PATH, 'utf-8')
    console.log('Current config file contents:', existingConfig)
    
    const configLines = existingConfig.split('\n')
    console.log('Processing', configLines.length, 'lines')
    
    // Update only the bandwidth values
    const updatedLines = configLines.map(line => {
      if (line.trim().startsWith('#') || !line.trim()) {
        return line
      }
      const match = line.match(/^(\w+)="([^"]*)"/)
      if (match) {
        const [, key] = match
        if (data[key] !== undefined) {
          // Handle bandwidth values with units
          if (key.includes('BANDWIDTH')) {
            const bandwidthValue = data[key] as BandwidthValue
            const newLine = `${key}="${bandwidthValue.value}${bandwidthValue.unit}"`
            console.log('Updating bandwidth line:', { original: line, new: newLine })
            return newLine
          }
          const newLine = `${key}="${data[key]}"`
          console.log('Updating non-bandwidth line:', { original: line, new: newLine })
          return newLine
        }
      }
      return line
    })
    
    // Write back the entire config with preserved formatting
    console.log('Writing updated config back to file...')
    console.log('New config contents:', updatedLines.join('\n'))
    await fs.writeFile(CONFIG_PATH, updatedLines.join('\n'))
    console.log('Config file write complete')
    
    // Execute update script
    console.log('Executing update script:', UPDATE_SCRIPT)
    const { stdout, stderr } = await execAsync(UPDATE_SCRIPT)
    console.log('Update script stdout:', stdout)
    if (stderr) {
      console.log('Update script stderr:', stderr)
    }
    console.log('Update script execution complete')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Config update error:', error)
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json({ error: 'Failed to update config', details: String(error) }, { status: 500 })
  } finally {
    console.log('POST /api/network-config completed')
  }
} 