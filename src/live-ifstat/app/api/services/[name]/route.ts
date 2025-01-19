import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(
  request: Request,
  { params }: { params: { name: string } }
) {
  try {
    const serviceName = params.name
    // Validate service name to prevent command injection while allowing common service name characters
    if (!serviceName.match(/^[a-zA-Z0-9-._@]+$/)) {
      return NextResponse.json({ error: 'Invalid service name' }, { status: 400 })
    }

    const { stdout } = await execAsync(`systemctl status ${serviceName}`)
    
    // Split output into lines and remove the last 10 lines (logs)
    const lines = stdout.split('\n')
    const statusInfo = lines.slice(0, -10).join('\n')

    return NextResponse.json({ status: statusInfo })
  } catch (error) {
    console.error('Error fetching service status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
} 