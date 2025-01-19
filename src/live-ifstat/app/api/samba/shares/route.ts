import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'

const execAsync = promisify(exec)

const CONFIG_FILE = '/etc/samba/smb.conf'
const BACKUP_FILE = '/etc/samba/smb.conf.bak'

interface ShareConfig {
  name: string
  path: string
  validUsers: string[]
  readOnly: boolean
  browseable: boolean
  guestOk: boolean
}

async function readConfig(): Promise<{ shares: ShareConfig[], globalConfig: string }> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8')
    const sections = content.split(/\[.*?\]/)
    const globalConfig = sections[1] || ''
    
    const shares: ShareConfig[] = []
    for (let i = 2; i < sections.length; i++) {
      const section = sections[i]
      const name = content.match(new RegExp(`\\[(.*?)\\]${section}`))?.[1]
      if (!name || name === 'global') continue

      const config: ShareConfig = {
        name,
        path: '',
        validUsers: [],
        readOnly: true,
        browseable: true,
        guestOk: false
      }

      const lines = section.split('\n')
      for (const line of lines) {
        const [key, value] = line.trim().split('=').map(s => s.trim())
        if (!key || !value) continue

        switch (key.toLowerCase()) {
          case 'path':
            config.path = value
            break
          case 'valid users':
            config.validUsers = value.split(',').map(u => u.trim())
            break
          case 'read only':
            config.readOnly = value.toLowerCase() === 'yes'
            break
          case 'browseable':
            config.browseable = value.toLowerCase() === 'yes'
            break
          case 'guest ok':
            config.guestOk = value.toLowerCase() === 'yes'
            break
        }
      }
      shares.push(config)
    }

    return { shares, globalConfig }
  } catch (error) {
    console.error('Error reading Samba config:', error)
    throw new Error('Failed to read Samba configuration')
  }
}

async function writeConfig(shares: ShareConfig[], globalConfig: string) {
  try {
    // Backup current config
    await fs.copyFile(CONFIG_FILE, BACKUP_FILE)

    let content = '[global]\n' + globalConfig.trim() + '\n\n'
    
    for (const share of shares) {
      content += `[${share.name}]\n`
      content += `path = ${share.path}\n`
      if (share.validUsers.length > 0) {
        content += `valid users = ${share.validUsers.join(', ')}\n`
      }
      content += `read only = ${share.readOnly ? 'yes' : 'no'}\n`
      content += `browseable = ${share.browseable ? 'yes' : 'no'}\n`
      content += `guest ok = ${share.guestOk ? 'yes' : 'no'}\n\n`
    }

    await fs.writeFile(CONFIG_FILE, content)
    
    // Test config
    await execAsync('testparm -s')
    
    // Reload Samba instead of restart
    await execAsync('systemctl reload smbd')

    return true
  } catch (err) {
    // Restore backup if something went wrong
    try {
      await fs.copyFile(BACKUP_FILE, CONFIG_FILE)
    } catch (restoreError) {
      console.error('Failed to restore backup:', restoreError)
    }
    
    console.error('Error writing Samba config:', err)
    throw new Error('Failed to update Samba configuration')
  }
}

export async function GET() {
  try {
    const { shares } = await readConfig()
    return NextResponse.json(shares)
  } catch {
    return NextResponse.json(
      { error: 'Failed to read shares' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const share: ShareConfig = await request.json()
    
    // Validate share data
    if (!share.name || !share.path) {
      return NextResponse.json(
        { error: 'Name and path are required' },
        { status: 400 }
      )
    }

    // Read current config
    const { shares, globalConfig } = await readConfig()
    
    // Check if share already exists
    if (shares.some(s => s.name === share.name)) {
      return NextResponse.json(
        { error: 'Share already exists' },
        { status: 400 }
      )
    }

    // Add new share
    shares.push(share)

    // Write updated config
    await writeConfig(shares, globalConfig)

    return NextResponse.json(share)
  } catch {
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const share: ShareConfig = await request.json()
    
    // Validate share data
    if (!share.name || !share.path) {
      return NextResponse.json(
        { error: 'Name and path are required' },
        { status: 400 }
      )
    }

    // Read current config
    const { shares, globalConfig } = await readConfig()
    
    // Find and update share
    const index = shares.findIndex(s => s.name === share.name)
    if (index === -1) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      )
    }

    shares[index] = share

    // Write updated config
    await writeConfig(shares, globalConfig)

    return NextResponse.json(share)
  } catch {
    return NextResponse.json(
      { error: 'Failed to update share' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    
    if (!name) {
      return NextResponse.json(
        { error: 'Share name is required' },
        { status: 400 }
      )
    }

    // Read current config
    const { shares, globalConfig } = await readConfig()
    
    // Find and remove share
    const index = shares.findIndex(s => s.name === name)
    if (index === -1) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      )
    }

    shares.splice(index, 1)

    // Write updated config
    await writeConfig(shares, globalConfig)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete share' },
      { status: 500 }
    )
  }
} 