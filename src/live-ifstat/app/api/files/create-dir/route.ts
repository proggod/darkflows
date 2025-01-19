import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: Request) {
  try {
    const { path: dirPath } = await request.json()
    
    if (!dirPath) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      )
    }

    // Basic path sanitization
    const normalizedPath = path.normalize(dirPath).replace(/^(\.\.(\/|\\|$))+/, '')
    
    await fs.mkdir(normalizedPath, { recursive: true })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating directory:', error)
    return NextResponse.json(
      { error: 'Failed to create directory' },
      { status: 500 }
    )
  }
} 