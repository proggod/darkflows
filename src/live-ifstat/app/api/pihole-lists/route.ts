import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const LIST_MANAGER_SCRIPT = '/usr/local/darkflows/bin/pihole-list-manager.py'

interface ListEntry {
  domain: string
  type: 'whitelist' | 'blacklist'
}

// Helper to parse the list output into structured data
function parseListOutput(output: string): string[] {
  return output
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      // Filter out empty lines, headers, and separator lines
      return trimmed && 
             !trimmed.startsWith('ID') && 
             !trimmed.startsWith('Domain') && 
             !trimmed.startsWith('Type') && 
             !trimmed.includes('--------')
    })
    .map(line => {
      // Extract just the domain name from the line
      // Format is: "ID     domain                                Type"
      const parts = line.trim().split(/\s+/)
      // Skip the ID (parts[0]), take the domain (parts[1])
      return parts[1]
    })
    .filter(Boolean) // Remove any undefined/empty entries
}

// GET handler to list all entries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type || (type !== 'whitelist' && type !== 'blacklist')) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 })
    }

    const { stdout } = await execAsync(`python3 ${LIST_MANAGER_SCRIPT} ${type} list`)
    const entries = parseListOutput(stdout)
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Error in GET:', error)
    const message = error instanceof Error ? error.message : 'Failed to list entries'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST handler to add entries
export async function POST(request: Request) {
  try {
    const { type, domain } = await request.json()
    
    if (!type || (type !== 'whitelist' && type !== 'blacklist')) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 })
    }

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    await execAsync(`python3 ${LIST_MANAGER_SCRIPT} ${type} add ${domain}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST:', error)
    const message = error instanceof Error ? error.message : 'Failed to add entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE handler to remove entries
export async function DELETE(request: Request) {
  try {
    const { type, domain } = await request.json()
    
    if (!type || (type !== 'whitelist' && type !== 'blacklist')) {
      return NextResponse.json({ error: 'Invalid list type' }, { status: 400 })
    }

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    await execAsync(`python3 ${LIST_MANAGER_SCRIPT} ${type} remove ${domain}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE:', error)
    const message = error instanceof Error ? error.message : 'Failed to remove entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
} 