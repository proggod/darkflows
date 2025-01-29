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
    
    // Return a default value if no active connection is found
    if (!active) {
      return NextResponse.json({ active: 'UNKNOWN' })
    }
    
    return NextResponse.json({ active })
  } catch (error) {
    console.error('Error reading active gateway:', error)
    // Return a safe default instead of failing
    return NextResponse.json({ active: 'UNKNOWN' })
  }
} 