import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    const { stdout } = await execAsync('/usr/local/darkflows/bin/connection_status.sh')
    // The script outputs multiple lines, but the active connection is on its own line as either PRIMARY or SECONDARY
    const lines = stdout.split('\n')
    const active = lines.find(line => line === 'PRIMARY' || line === 'SECONDARY')
    
    if (!active) {
      throw new Error('Could not determine active connection')
    }
    
    return NextResponse.json({ active })
  } catch (error) {
    console.error('Error reading active gateway:', error)
    return NextResponse.json(
      { error: 'Failed to read active gateway status' },
      { status: 500 }
    )
  }
} 