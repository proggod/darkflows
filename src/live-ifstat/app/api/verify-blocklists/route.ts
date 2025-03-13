import { NextResponse, NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const VERIFY_SCRIPT = '/usr/local/darkflows/bin/verify_blocklists.py'

export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    const { vlanId: vlanIdParam = 'default' } = await request.json()
    const vlanId = vlanIdParam === 'default' ? 0 : Number(vlanIdParam)
    
    // Execute the verify_blocklists.py script
    const { stdout, stderr } = await execAsync(`python3 ${VERIFY_SCRIPT} ${vlanId}`)
    
    if (stderr) {
      console.error('Error verifying blocklists:', stderr)
      return NextResponse.json({ error: 'Failed to verify blocklists' }, { status: 500 })
    }
    
    // Parse the output to get updated entries
    const updatedEntries = stdout
      .split('\n')
      .filter(line => line.startsWith('UPDATED:'))
      .map(line => {
        const parts = line.substring('UPDATED:'.length).trim().split(' ')
        if (parts.length >= 3) {
          return {
            vlanId: parts[0],
            name: parts[1],
            url: parts.slice(2).join(' ')
          }
        }
        return null
      })
      .filter(Boolean)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Blocklists verified and applied successfully',
      updatedEntries
    })
  } catch (error) {
    console.error('Error executing verify_blocklists.py:', error)
    return NextResponse.json(
      { error: 'Failed to verify blocklists' },
      { status: 500 }
    )
  }
} 