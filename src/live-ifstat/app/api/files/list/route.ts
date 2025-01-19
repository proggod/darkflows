import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dirPath = searchParams.get('path') || '/'

    // Basic path sanitization
    const normalizedPath = path.normalize(dirPath).replace(/^(\.\.(\/|\\|$))+/, '')
    
    const entries = await fs.readdir(normalizedPath, { withFileTypes: true })
    
    const fileEntries: FileEntry[] = entries
      .filter(entry => entry.isDirectory()) // Only show directories
      .map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(normalizedPath, entry.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(fileEntries)
  } catch (error) {
    console.error('Error listing directory:', error)
    return NextResponse.json(
      { error: 'Failed to list directory' },
      { status: 500 }
    )
  }
} 