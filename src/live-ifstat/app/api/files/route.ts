import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dirPath = searchParams.get('path') || '/'

    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const files = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name)
    }))

    return NextResponse.json(files)
  } catch {
    return NextResponse.json(
      { error: 'Failed to read directory' },
      { status: 500 }
    )
  }
} 