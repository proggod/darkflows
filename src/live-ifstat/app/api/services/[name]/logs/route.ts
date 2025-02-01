import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { requireAuth } from '../../../../lib/auth'

const execAsync = promisify(exec)

interface RouteContext {
  params: Promise<{
    name: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Check authentication first
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  try {
    // Await the params Promise to get the actual parameters
    const { name } = await context.params;
    
    // Validate service name to prevent command injection while allowing common service name characters
    if (!name.match(/^[a-zA-Z0-9-._@]+$/)) {
      return NextResponse.json({ error: 'Invalid service name' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '1440'
    
    // Validate time range
    if (!timeRange.match(/^[0-9]+$/)) {
      return NextResponse.json({ error: 'Invalid time range' }, { status: 400 })
    }

    const { stdout } = await execAsync(`journalctl -u ${name}.service --since "${timeRange} minute ago"`)
    
    return NextResponse.json({ logs: stdout })
  } catch (error) {
    console.error('Error fetching service logs:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
} 