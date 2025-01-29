import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

interface SshKey {
  id: string // Will be a hash of the key
  type: string // ssh-rsa, ssh-ed25519, etc.
  key: string
  comment?: string
}

interface UserKeys {
  username: string
  keys: SshKey[]
}

const SSH_DIR = '/etc/ssh'

async function getUserKeys(username: string): Promise<SshKey[]> {
  try {
    const userDir = path.join(SSH_DIR, username)
    const keyFile = path.join(userDir, 'authorized_keys')
    
    try {
      await fs.access(userDir)
    } catch {
      await fs.mkdir(userDir, { recursive: true })
      await execAsync(`chown ${username}:${username} ${userDir}`)
      await execAsync(`chmod 700 ${userDir}`)
      await fs.writeFile(keyFile, '', { mode: 0o600 })
      await execAsync(`chown ${username}:${username} ${keyFile}`)
    }

    try {
      await fs.access(keyFile)
    } catch {
      // Create empty authorized_keys file if it doesn't exist
      await fs.writeFile(keyFile, '', { mode: 0o600 })
      await execAsync(`chown ${username}:${username} ${keyFile}`)
    }

    const content = await fs.readFile(keyFile, 'utf-8')
    const keys = content.split('\n')
      .filter(line => line.trim())
      .filter(line => !line.includes('BEGIN') && !line.includes('END')) // Filter out private key markers
      .map(line => {
        const parts = line.trim().split(' ')
        if (parts.length < 2) {
          console.log('Skipping invalid line:', line)
          return null
        }
        
        const type = parts[0]
        const key = parts[1]
        const comment = parts.slice(2).join(' ')
        
        try {
          const keyEnd = key.slice(-32) || key
          const random = Math.floor(Math.random() * 10000)
          const id = Buffer.from(`${username}-${keyEnd}-${random}`).toString('base64')
          return { id, type, key, comment } as SshKey
        } catch (error) {
          console.error('Error processing key line:', error)
          return null
        }
      })
      .filter((key): key is SshKey => key !== null) // Remove any null entries
    
    return keys
  } catch (error) {
    console.error('Error in getUserKeys:', error)
    throw new Error('Failed to read SSH keys')
  }
}

async function getUsers(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('getent passwd')
    return stdout.split('\n')
      .filter(line => line)
      .filter(line => {
        const [username, , uid] = line.split(':')
        const uidNum = parseInt(uid)
        return username === 'root' || (uidNum >= 1000 && uidNum < 65534)
      })
      .map(line => line.split(':')[0])
  } catch (error) {
    console.error('Error getting users:', error)
    throw new Error('Failed to get users')
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (username) {
      const keys = await getUserKeys(username)
      return NextResponse.json(keys)
    }

    const users = await getUsers()
    const usersWithKeys: UserKeys[] = await Promise.all(
      users.map(async username => ({
        username,
        keys: await getUserKeys(username)
      }))
    )
    return NextResponse.json(usersWithKeys)
  } catch (error) {
    console.error('Error in GET /api/ssh-keys:', error)
    return NextResponse.json(
      { error: 'Failed to get SSH keys' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { username, key } = await request.json()
    
    if (!username || !key) {
      console.log('Error: Missing username or key')
      return NextResponse.json(
        { error: 'Username and key are required' },
        { status: 400 }
      )
    }

    const userDir = path.join(SSH_DIR, username)
    const keyFile = path.join(userDir, 'authorized_keys')

    try {
      await fs.access(userDir)
    } catch {
      await fs.mkdir(userDir, { recursive: true })
    }

    await fs.appendFile(keyFile, key.trim() + '\n')
    
    await execAsync(`chown -R ${username}:${username} ${userDir}`)
    await execAsync(`chmod 700 ${userDir}`)
    await execAsync(`chmod 600 ${keyFile}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/ssh-keys:', error)
    // Log the full error details
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add SSH key' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const keyId = searchParams.get('keyId')
    
    if (!username || !keyId) {
      return NextResponse.json(
        { error: 'Username and keyId are required' },
        { status: 400 }
      )
    }

    const userDir = path.join(SSH_DIR, username)
    const keyFile = path.join(userDir, 'authorized_keys')

    const keys = await getUserKeys(username)
    const filteredKeys = keys.filter(k => k.id !== keyId)
    
    await fs.writeFile(
      keyFile,
      filteredKeys.map(k => `${k.type} ${k.key}${k.comment ? ` ${k.comment}` : ''}`).join('\n') + '\n'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/ssh-keys:', error)
    return NextResponse.json(
      { error: 'Failed to delete SSH key' },
      { status: 500 }
    )
  }
} 