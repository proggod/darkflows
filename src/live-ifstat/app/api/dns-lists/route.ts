import { NextResponse, NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import mysql from 'mysql2/promise'

// GET handler to list all entries
export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  const type = request.nextUrl.searchParams.get('type')
  if (!type || !['whitelist', 'blacklist'].includes(type)) {
    return NextResponse.json({ error: 'Invalid list type' }, { status: 400 })
  }

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
      `SELECT domain FROM ${type} WHERE vlan_id = ? ORDER BY domain`,
      [vlanId]
    )

    return NextResponse.json({ entries: entries.map(e => e.domain) })
  } catch (error) {
    console.error(`Error fetching ${type}:`, error)
    return NextResponse.json(
      { error: `Failed to fetch ${type}` },
      { status: 500 }
    )
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
    const { type, domain, vlanId: vlanIdParam = 'default' } = await request.json()
    const vlanId = vlanIdParam === 'default' ? 0 : Number(vlanIdParam)
    
    if (!type || !['whitelist', 'blacklist'].includes(type)) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 })
    }
    
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
    }

    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: 'root',
      database: 'unbound'
    })

    await connection.execute(
      `INSERT INTO ${type} (domain, vlan_id) VALUES (?, ?)`,
      [domain, vlanId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding domain:', error)
    return NextResponse.json(
      { error: 'Failed to add domain' },
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
    const { type, domain, vlanId: vlanIdParam = 'default' } = await request.json()
    const vlanId = vlanIdParam === 'default' ? 0 : Number(vlanIdParam)
    
    if (!type || !['whitelist', 'blacklist'].includes(type)) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 })
    }
    
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
    }

    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: 'root',
      database: 'unbound'
    })

    await connection.execute(
      `DELETE FROM ${type} WHERE domain = ? AND vlan_id = ?`,
      [domain, vlanId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting domain:', error)
    return NextResponse.json(
      { error: 'Failed to delete domain' },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
} 