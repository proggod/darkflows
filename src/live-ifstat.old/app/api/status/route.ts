import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'

interface InterfaceStatus {
  new_drops: number
  backlog: number
  memory: number
}

interface StatusData {
  timestamp: string
  interfaces: {
    [key: string]: InterfaceStatus
  }
}

export async function GET() {
  try {
    console.log('Attempting to read status file...')
    const content = await readFile('/dev/shm/status.json', 'utf-8')
    console.log('Status file content:', content)
    
    const cleanContent = content.replace(/,(\s*[}\]])/g, '$1')
    
    const data: StatusData = JSON.parse(cleanContent)
    console.log('Parsed status data:', data)
    
    return NextResponse.json(data)
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Detailed error reading status:', {
        error,
        message: error.message,
        stack: error.stack,
        code: error instanceof Error && 'code' in error ? error.code : undefined  // code is not a standard Error property
      })
      return NextResponse.json({ 
        error: `Failed to read status: ${error.message}`,
        code: error instanceof Error && 'code' in error ? error.code : undefined
      }, { status: 500 })
    }
    // Handle case where error is not an Error object
    return NextResponse.json({ 
      error: 'An unknown error occurred'
    }, { status: 500 })
  }
} 