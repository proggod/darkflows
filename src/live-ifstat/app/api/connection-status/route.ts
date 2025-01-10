import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import util from 'util'

const execAsync = util.promisify(exec)
const STATUS_SCRIPT = '/usr/local/darkflows/bin/connection_status.sh'

export async function GET() {
  try {
    const { stdout } = await execAsync(STATUS_SCRIPT)
    const match = stdout.match(/Current connection: (\w+)/)
    const activeConnection = match ? match[1] : null
    return NextResponse.json({ active: activeConnection })
  } catch (error) {
    console.error('Failed to get connection status:', error)
    return NextResponse.json({ error: 'Failed to get connection status' }, { status: 500 })
  }
} 