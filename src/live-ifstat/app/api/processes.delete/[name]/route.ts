import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Define the context type with params as a Promise
interface RouteContext {
  params: Promise<{
    name: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Await the params Promise to get the actual parameters
    const { name } = await context.params;

    // Validate service name to prevent command injection
    if (!name.match(/^[a-zA-Z0-9-]+$/)) {
      return NextResponse.json({ error: 'Invalid service name' }, { status: 400 })
    }

    const { stdout } = await execAsync(`systemctl status ${name}`)
    
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