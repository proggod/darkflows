import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)
const LOCAL_FORWARDS_FILE = '/etc/darkflows/local_forwards.txt'
const EXTERNAL_FORWARDS_FILE = '/etc/darkflows/external_forwards.txt'
const UPDATE_LOCAL_SCRIPT = '/usr/local/darkflows/bin/update_local_forwards.sh'
const UPDATE_EXTERNAL_SCRIPT = '/usr/local/darkflows/bin/update_external_forwards.sh'

interface LocalForward {
  externalPort: number
  localPort?: number
}

interface ExternalForward {
  externalPort: number
  internalIp: string
  internalPort: number
}

// Helper to ensure directory exists
async function ensureDir(filePath: string) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

// Helper to read local forwards
async function readLocalForwards(): Promise<LocalForward[]> {
  try {
    await fs.access(LOCAL_FORWARDS_FILE)
    const content = await fs.readFile(LOCAL_FORWARDS_FILE, 'utf-8')
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const [externalPort, localPort] = line.split(':').map(Number)
        return {
          externalPort,
          localPort: localPort || externalPort
        }
      })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await ensureDir(LOCAL_FORWARDS_FILE)
      await fs.writeFile(LOCAL_FORWARDS_FILE, '', { mode: 0o644 })
      return []
    }
    throw error
  }
}

// Helper to read external forwards
async function readExternalForwards(): Promise<ExternalForward[]> {
  try {
    await fs.access(EXTERNAL_FORWARDS_FILE)
    const content = await fs.readFile(EXTERNAL_FORWARDS_FILE, 'utf-8')
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const [externalPort, internalIp, internalPort] = line.split(':')
        return {
          externalPort: Number(externalPort),
          internalIp,
          internalPort: Number(internalPort)
        }
      })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await ensureDir(EXTERNAL_FORWARDS_FILE)
      await fs.writeFile(EXTERNAL_FORWARDS_FILE, '', { mode: 0o644 })
      return []
    }
    throw error
  }
}

// Helper to write local forwards
async function writeLocalForwards(forwards: LocalForward[]): Promise<void> {
  const content = forwards
    .map(f => f.localPort === f.externalPort ? `${f.externalPort}` : `${f.externalPort}:${f.localPort}`)
    .join('\n')
  await ensureDir(LOCAL_FORWARDS_FILE)
  await fs.writeFile(LOCAL_FORWARDS_FILE, content + '\n', { mode: 0o644 })
}

// Helper to write external forwards
async function writeExternalForwards(forwards: ExternalForward[]): Promise<void> {
  const content = forwards
    .map(f => `${f.externalPort}:${f.internalIp}:${f.internalPort}`)
    .join('\n')
  await ensureDir(EXTERNAL_FORWARDS_FILE)
  await fs.writeFile(EXTERNAL_FORWARDS_FILE, content + '\n', { mode: 0o644 })
}

// Helper to update forwards
async function updateForwards(type: 'local' | 'external' | 'both'): Promise<void> {
  try {
    if (type === 'local' || type === 'both') {
      const { stderr: localStderr } = await execAsync(`${UPDATE_LOCAL_SCRIPT}`)
      if (localStderr) {
        console.error('Local script stderr:', localStderr)
        throw new Error(`Update local script error: ${localStderr}`)
      }
    }
    
    if (type === 'external' || type === 'both') {
      const { stderr: externalStderr } = await execAsync(`${UPDATE_EXTERNAL_SCRIPT}`)
      if (externalStderr) {
        console.error('External script stderr:', externalStderr)
        throw new Error(`Update external script error: ${externalStderr}`)
      }
    }
  } catch (error) {
    console.error('Error updating forwards:', error)
    throw error instanceof Error ? error : new Error('Failed to update forwards')
  }
}

// GET handler
export async function GET() {
  try {
    const [localForwards, externalForwards] = await Promise.all([
      readLocalForwards(),
      readExternalForwards()
    ])
    return NextResponse.json({ localForwards, externalForwards })
  } catch (error) {
    console.error('Error in GET:', error)
    const message = error instanceof Error ? error.message : 'Failed to read forwards'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST handler for local forwards
export async function POST(request: Request) {
  try {
    const { type, forward } = await request.json()
    
    // Read both types of forwards to check for conflicts
    const [localForwards, externalForwards] = await Promise.all([
      readLocalForwards(),
      readExternalForwards()
    ])

    // Check if port is already in use in either local or external forwards
    const isPortInUse = localForwards.some(f => f.externalPort === forward.externalPort) ||
                       externalForwards.some(f => f.externalPort === forward.externalPort)

    if (isPortInUse) {
      return NextResponse.json({ error: 'Port already in use in local or external forwards' }, { status: 400 })
    }
    
    if (type === 'local') {
      // Validate ports
      if (!forward.externalPort || forward.externalPort < 1 || forward.externalPort > 65535) {
        return NextResponse.json({ error: 'Invalid external port' }, { status: 400 })
      }
      if (forward.localPort && (forward.localPort < 1 || forward.localPort > 65535)) {
        return NextResponse.json({ error: 'Invalid local port' }, { status: 400 })
      }
      
      localForwards.push(forward)
      await writeLocalForwards(localForwards)
      await updateForwards('local')
    } else if (type === 'external') {
      // Validate ports and IP
      if (!forward.externalPort || forward.externalPort < 1 || forward.externalPort > 65535) {
        return NextResponse.json({ error: 'Invalid external port' }, { status: 400 })
      }
      if (!forward.internalPort || forward.internalPort < 1 || forward.internalPort > 65535) {
        return NextResponse.json({ error: 'Invalid internal port' }, { status: 400 })
      }
      if (!forward.internalIp || !/^(\d{1,3}\.){3}\d{1,3}$/.test(forward.internalIp)) {
        return NextResponse.json({ error: 'Invalid internal IP address' }, { status: 400 })
      }
      
      externalForwards.push(forward)
      await writeExternalForwards(externalForwards)
      await updateForwards('external')
    } else {
      return NextResponse.json({ error: 'Invalid forward type' }, { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST:', error)
    const message = error instanceof Error ? error.message : 'Failed to add forward'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE handler
export async function DELETE(request: Request) {
  try {
    const { type, externalPort } = await request.json()
    
    if (type === 'local') {
      const localForwards = await readLocalForwards()
      const newForwards = localForwards.filter(f => f.externalPort !== externalPort)
      if (localForwards.length === newForwards.length) {
        return NextResponse.json({ error: 'Forward not found' }, { status: 404 })
      }
      await writeLocalForwards(newForwards)
      await updateForwards('local')
    } else if (type === 'external') {
      const externalForwards = await readExternalForwards()
      const newForwards = externalForwards.filter(f => f.externalPort !== externalPort)
      if (externalForwards.length === newForwards.length) {
        return NextResponse.json({ error: 'Forward not found' }, { status: 404 })
      }
      await writeExternalForwards(newForwards)
      await updateForwards('external')
    } else {
      return NextResponse.json({ error: 'Invalid forward type' }, { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete forward'
    return NextResponse.json({ error: message }, { status: 500 })
  }
} 