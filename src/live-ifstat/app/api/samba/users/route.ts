import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'

const execAsync = promisify(exec)

const HIDE_USERS_FILE = '/etc/darkflows/hide_users.txt'
const HIDE_GROUPS_FILE = '/etc/darkflows/hide_groups.txt'

interface SambaUser {
  username: string
  groups: string[]
  enabled: boolean
}

async function getHiddenItems(file: string): Promise<Set<string>> {
  try {
    const content = await fs.readFile(file, 'utf-8')
    return new Set(content.split('\n').map(line => line.trim()).filter(Boolean))
  } catch (error) {
    console.error(`Error reading ${file}:`, error)
    return new Set()
  }
}

async function getUsers(): Promise<SambaUser[]> {
  try {
    // Get hidden users
    const hiddenUsers = await getHiddenItems(HIDE_USERS_FILE)
    const hiddenGroups = await getHiddenItems(HIDE_GROUPS_FILE)

    // Get Samba users first
    const { stdout: sambaUsers } = await execAsync('pdbedit -L')
    const sambaUserList = sambaUsers.trim().split('\n')
      .map(line => line.split(':')[0])
      .filter(Boolean)
      .filter(user => !hiddenUsers.has(user))

    // Get disabled users - handle case when no users are disabled
    let disabledSet = new Set<string>()
    try {
      const { stdout: disabledUsers } = await execAsync('pdbedit -L -u | grep "Account Flags.*D"')
      if (disabledUsers) {
        disabledSet = new Set(
          disabledUsers.trim().split('\n')
            .map(line => line.split(':')[0])
            .filter(Boolean)
        )
      }
    } catch {
      // If grep fails (no matches), that's fine - it means no users are disabled
      console.log('No disabled users found')
    }

    // Get groups for each user
    const userDetails = await Promise.all(sambaUserList.map(async username => {
      const { stdout: groupList } = await execAsync(`groups ${username}`)
      const groups = groupList.split(':')[1]?.trim().split(' ')
        .filter(Boolean)
        .filter(group => !hiddenGroups.has(group)) || []
      
      return {
        username,
        groups,
        enabled: !disabledSet.has(username)
      }
    }))

    return userDetails
  } catch (error) {
    console.error('Error getting users:', error)
    throw new Error('Failed to get users')
  }
}

async function getGroups(): Promise<string[]> {
  try {
    // Get hidden groups
    const hiddenGroups = await getHiddenItems(HIDE_GROUPS_FILE)

    const { stdout } = await execAsync('getent group')
    return stdout.trim().split('\n')
      .map(line => line.split(':')[0])
      .filter(Boolean)
      .filter(group => !hiddenGroups.has(group))
  } catch (error) {
    console.error('Error getting groups:', error)
    throw new Error('Failed to get groups')
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'groups') {
      const groups = await getGroups()
      return NextResponse.json(groups)
    } else {
      const users = await getUsers()
      return NextResponse.json(users)
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    if (data.type === 'group') {
      // Create group
      if (!data.name) {
        return NextResponse.json(
          { error: 'Group name is required' },
          { status: 400 }
        )
      }

      try {
        await execAsync(`groupadd ${data.name}`)
      } catch (err) {
        console.error('Error creating group:', err)
        return NextResponse.json(
          { error: 'Failed to create group - it may already exist' },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: true })
    } else {
      // Create user
      if (!data.name || !data.password) {
        return NextResponse.json(
          { error: 'Username and password are required' },
          { status: 400 }
        )
      }

      try {
        // Create user and set password
        await execAsync(`useradd -M -s /usr/sbin/nologin ${data.name}`)
      } catch (err) {
        console.error('Error creating user:', err)
        return NextResponse.json(
          { error: 'Failed to create user - it may already exist' },
          { status: 400 }
        )
      }

      try {
        await execAsync(`(echo "${data.password}"; echo "${data.password}") | smbpasswd -s -a ${data.name}`)
      } catch (err) {
        // Try to clean up the system user if Samba user creation fails
        try {
          await execAsync(`userdel ${data.name}`)
        } catch (cleanupErr) {
          console.error('Failed to clean up system user:', cleanupErr)
        }
        console.error('Error setting Samba password:', err)
        return NextResponse.json(
          { error: 'Failed to set user password' },
          { status: 400 }
        )
      }
      
      // Add to groups if specified
      if (data.groups && data.groups.length > 0) {
        try {
          await execAsync(`usermod -G ${data.groups.join(',')} ${data.name}`)
        } catch (err) {
          console.error('Error setting groups:', err)
          // Non-fatal error, continue
        }
      }

      // Enable/disable user
      if (data.enabled === false) {
        try {
          await execAsync(`smbpasswd -d ${data.name}`)
        } catch (err) {
          console.error('Error disabling user:', err)
          // Non-fatal error, continue
        }
      }

      try {
        // Reload Samba to apply changes
        await execAsync('systemctl reload smbd')
      } catch (err) {
        console.error('Error reloading Samba:', err)
        // Non-fatal error, continue
      }

      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Error creating user/group:', error)
    return NextResponse.json(
      { error: 'Failed to create user/group' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    
    if (!data.name) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Update password if provided
    if (data.password) {
      try {
        await execAsync(`(echo "${data.password}"; echo "${data.password}") | smbpasswd -s ${data.name}`)
      } catch (err) {
        console.error('Error updating password:', err)
        return NextResponse.json(
          { error: 'Failed to update password' },
          { status: 400 }
        )
      }
    }

    // Update groups if provided
    if (data.groups) {
      try {
        await execAsync(`usermod -G ${data.groups.join(',')} ${data.name}`)
      } catch (err) {
        console.error('Error updating groups:', err)
        return NextResponse.json(
          { error: 'Failed to update groups' },
          { status: 400 }
        )
      }
    }

    // Update enabled status
    if (typeof data.enabled === 'boolean') {
      try {
        if (data.enabled) {
          await execAsync(`smbpasswd -e ${data.name}`)
        } else {
          await execAsync(`smbpasswd -d ${data.name}`)
        }
      } catch (err) {
        console.error('Error updating user status:', err)
        return NextResponse.json(
          { error: 'Failed to update user status' },
          { status: 400 }
        )
      }
    }

    try {
      // Reload Samba to apply changes
      await execAsync('systemctl reload smbd')
    } catch (err) {
      console.error('Error reloading Samba:', err)
      // Non-fatal error, continue
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    const type = searchParams.get('type')
    
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (type === 'group') {
      await execAsync(`groupdel ${name}`)
    } else {
      await execAsync(`smbpasswd -x ${name}`)
      await execAsync(`userdel ${name}`)
    }

    // Reload Samba to apply changes
    await execAsync('systemctl reload smbd')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user/group:', error)
    return NextResponse.json(
      { error: 'Failed to delete user/group' },
      { status: 500 }
    )
  }
} 