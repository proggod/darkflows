import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'

export async function GET() {
  try {
    const content = await readFile('/dev/shm/ping_status.json', 'utf-8')
    const data = JSON.parse(content)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to read ping status' }, { status: 500 })
  }
} 