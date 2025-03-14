import { NextResponse, NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import mysql from 'mysql2/promise'
import fs from 'fs/promises'
import path from 'path'

const BLOCKLISTS_DIR = '/etc/darkflows/unbound'

// Helper to ensure directory exists
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

// Helper to get blocklists file path
function getBlocklistsFilePath(vlanId: number | string): string {
  const vlanDir = vlanId === 0 ? 'default' : vlanId.toString()
  return path.join(BLOCKLISTS_DIR, vlanDir, 'blocklists.json')
}

// Helper to read blocklists from file
async function readBlocklists(vlanId: number | string): Promise<{ name: string; url: string }[]> {
  try {
    const filePath = getBlocklistsFilePath(vlanId)
    await ensureDirectoryExists(path.dirname(filePath))
    
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch  {
    // If file doesn't exist or is invalid, return empty array
    return []
  }
}

// Helper to write blocklists to file
async function writeBlocklists(vlanId: number | string, blocklists: { name: string; url: string }[]): Promise<void> {
  const filePath = getBlocklistsFilePath(vlanId)
  await ensureDirectoryExists(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(blocklists, null, 2))
}

// Helper to validate blocklist name (only letters and numbers, no spaces)
function isValidBlocklistName(name: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(name)
}

// GET handler to list all entries
export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  const vlanIdParam = request.nextUrl.searchParams.get('vlanId')
  const vlanId = vlanIdParam === 'default' ? 0 : Number(vlanIdParam) || 0

  let connection: mysql.Connection | undefined

  try {
    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: 'root',
      database: 'unbound'
    })

    const [entries] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT name, url FROM blocklists WHERE vlan_id = ? ORDER BY name`,
      [vlanId]
    )

    // Also read from file as a fallback
    const fileEntries = await readBlocklists(vlanId)
    
    // Combine entries from DB and file, prioritizing DB entries
    const dbEntryNames = new Set(entries.map(e => e.name))
    const combinedEntries = [
      ...entries,
      ...fileEntries.filter(e => !dbEntryNames.has(e.name))
    ]

    return NextResponse.json({ entries: combinedEntries })
  } catch (error) {
    console.error(`Error fetching blocklists:`, error)
    
    // Fallback to file if DB fails
    try {
      const fileEntries = await readBlocklists(vlanId)
      return NextResponse.json({ entries: fileEntries })
    } catch (fileError) {
      console.error(`Error reading blocklists file:`, fileError)
      return NextResponse.json(
        { error: `Failed to fetch blocklists` },
        { status: 500 }
      )
    }
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// POST handler to add entries
export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  let connection: mysql.Connection | undefined

  try {
    const { name, url, vlanId: vlanIdParam = 'default' } = await request.json()
    const vlanId = vlanIdParam === 'default' ? 0 : Number(vlanIdParam)
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    
    if (!isValidBlocklistName(name)) {
      return NextResponse.json({ 
        error: 'Name must contain only letters and numbers (no spaces or special characters)' 
      }, { status: 400 })
    }
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: 'root',
      database: 'unbound'
    })

    // First, try to insert into the database
    try {
      await connection.execute(
        `INSERT INTO blocklists (name, url, vlan_id) VALUES (?, ?, ?)`,
        [name, url, vlanId]
      )
    } catch (dbError) {
      console.error('Error adding to database:', dbError)
      
      // If DB insert fails, update the file
      const blocklists = await readBlocklists(vlanId)
      const existingIndex = blocklists.findIndex(b => b.name === name)
      
      if (existingIndex >= 0) {
        blocklists[existingIndex] = { name, url }
      } else {
        blocklists.push({ name, url })
      }
      
      await writeBlocklists(vlanId, blocklists)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding blocklist:', error)
    return NextResponse.json(
      { error: 'Failed to add blocklist' },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// DELETE handler to remove entries
export async function DELETE(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  let connection: mysql.Connection | undefined

  try {
    const { name, vlanId: vlanIdParam = 'default' } = await request.json()
    const vlanId = vlanIdParam === 'default' ? 0 : Number(vlanIdParam)
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }

    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: 'root',
      database: 'unbound'
    })

    // First, try to delete from the database
    try {
      await connection.execute(
        `DELETE FROM blocklists WHERE name = ? AND vlan_id = ?`,
        [name, vlanId]
      )
    } catch (dbError) {
      console.error('Error deleting from database:', dbError)
    }
    
    // Also update the file
    try {
      const blocklists = await readBlocklists(vlanId)
      const updatedBlocklists = blocklists.filter(b => b.name !== name)
      await writeBlocklists(vlanId, updatedBlocklists)
    } catch (fileError) {
      console.error('Error updating blocklists file:', fileError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting blocklist:', error)
    return NextResponse.json(
      { error: 'Failed to delete blocklist' },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
} 