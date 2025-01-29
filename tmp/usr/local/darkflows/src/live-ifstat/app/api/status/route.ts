import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'

export async function GET() {
  try {
    const content = await readFile('/dev/shm/status.json', 'utf-8')
    const data = JSON.parse(content)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading status:', error)
    // Return a default response that won't break the UI
    return NextResponse.json({
      timestamp: Date.now(),
      status: 'unknown',
      error: 'Failed to read status'
    }, { status: 500 })
  }
} 