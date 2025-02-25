import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { VLANConfig } from '@/types/dashboard'
import { requireAuth } from '@/lib/auth'
import { NextRequest } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const VLANS_FILE = '/etc/darkflows/vlans.json'
const UPDATE_SCRIPT = '/usr/local/darkflows/bin/update_vlans.py'
const NFTABLES_SHAPING_SCRIPT = '/usr/local/darkflows/bin/nftables_vlan_shaping.sh'

// Helper to validate bandwidth format
const isValidBandwidth = (bandwidth: string): boolean => {
  if (!bandwidth) return true // Optional field
  const regex = /^\d+(\.\d+)?(kbit|mbit|gbit|tbit)$/i
  return regex.test(bandwidth)
}

// Better implementation of bandwidth shaping
async function applyBandwidthShaping(vlanId: number): Promise<void> {
  console.log(`Applying bandwidth shaping for VLAN ID: ${vlanId}`)
  try {
    // Execute with sudo to ensure proper permissions
    const command = `${NFTABLES_SHAPING_SCRIPT} ${vlanId}`
    console.log(`Executing command: ${command}`)
    
    const { stdout, stderr } = await execAsync(command)
    console.log(`Shaping script output for VLAN ${vlanId}:`)
    console.log(stdout)
    
    if (stderr) {
      console.error(`Shaping script errors for VLAN ${vlanId}:`)
      console.error(stderr)
    }
  } catch (error) {
    console.error(`Error running nftables shaping script for VLAN ${vlanId}:`, error)
    throw error
  }
}

// Helper to read VLAN configurations
async function readVLANs(): Promise<VLANConfig[]> {
  try {
    const data = await readFile(VLANS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    // If file doesn't exist or is invalid, return empty array
    return []
  }
}

// Helper to write VLAN configurations
async function writeVLANs(vlans: VLANConfig[]): Promise<void> {
  await writeFile(VLANS_FILE, JSON.stringify(vlans, null, 2))
  // Run the update script to apply changes
  await execAsync(UPDATE_SCRIPT)
}

// Updated PUT handler following Next.js 15 conventions
export async function PUT(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    // Extract ID from URL using simpler approach
    const urlParts = request.url.split('/')
    const idStr = urlParts.pop() || ''
    const vlanId = parseInt(idStr, 10)
    
    if (isNaN(vlanId)) {
      return NextResponse.json({ error: 'Invalid VLAN ID' }, { status: 400 })
    }

    const updatedVlan: VLANConfig = await request.json()
    const vlans = await readVLANs()
    
    // Find the index of the VLAN to update
    const index = vlans.findIndex(v => v.id === vlanId)
    if (index === -1) {
      return NextResponse.json({ error: 'VLAN not found' }, { status: 404 })
    }

    // Validate bandwidth formats if provided
    if (updatedVlan.egressBandwidth && !isValidBandwidth(updatedVlan.egressBandwidth)) {
      return NextResponse.json({ error: 'Invalid egress bandwidth format' }, { status: 400 })
    }
    if (updatedVlan.ingressBandwidth && !isValidBandwidth(updatedVlan.ingressBandwidth)) {
      return NextResponse.json({ error: 'Invalid ingress bandwidth format' }, { status: 400 })
    }

    // Check if bandwidth settings have changed
    const existingVlan = vlans[index]
    const bandwidthChanged = 
      existingVlan.egressBandwidth !== updatedVlan.egressBandwidth ||
      existingVlan.ingressBandwidth !== updatedVlan.ingressBandwidth
    
    console.log('Bandwidth changed:', bandwidthChanged)
    console.log('Old values:', { 
      egress: existingVlan.egressBandwidth, 
      ingress: existingVlan.ingressBandwidth 
    })
    console.log('New values:', { 
      egress: updatedVlan.egressBandwidth, 
      ingress: updatedVlan.ingressBandwidth 
    })

    // Preserve created date from existing VLAN
    updatedVlan.created = existingVlan.created
    updatedVlan.modified = new Date()
    
    // Update the VLAN in the array
    vlans[index] = updatedVlan
    await writeVLANs(vlans)
    
    // Apply bandwidth shaping if bandwidth settings changed
    if (bandwidthChanged) {
      console.log('Bandwidth settings changed, applying shaping...')
      await applyBandwidthShaping(vlanId)
    }
    
    return NextResponse.json(updatedVlan)
  } catch (error) {
    console.error('Error updating VLAN:', error)
    return NextResponse.json({ error: 'Failed to update VLAN' }, { status: 500 })
  }
}

// Updated DELETE handler
export async function DELETE(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    // Extract ID from URL
    const urlParts = request.url.split('/')
    const idStr = urlParts.pop() || ''
    const vlanId = parseInt(idStr, 10)
    
    if (isNaN(vlanId)) {
      return NextResponse.json({ error: 'Invalid VLAN ID' }, { status: 400 })
    }

    const vlans = await readVLANs()
    
    // Filter out the VLAN to delete
    const filteredVlans = vlans.filter(v => v.id !== vlanId)
    
    // Check if any VLAN was removed
    if (filteredVlans.length === vlans.length) {
      return NextResponse.json({ error: 'VLAN not found' }, { status: 404 })
    }
    
    await writeVLANs(filteredVlans)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting VLAN:', error)
    return NextResponse.json({ error: 'Failed to delete VLAN' }, { status: 500 })
  }
}

// Updated GET handler
export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    // Extract ID from URL
    const urlParts = request.url.split('/')
    const idStr = urlParts.pop() || ''
    const vlanId = parseInt(idStr, 10)
    
    if (isNaN(vlanId)) {
      return NextResponse.json({ error: 'Invalid VLAN ID' }, { status: 400 })
    }

    const vlans = await readVLANs()
    const vlan = vlans.find(v => v.id === vlanId)
    
    if (!vlan) {
      return NextResponse.json({ error: 'VLAN not found' }, { status: 404 })
    }
    
    return NextResponse.json(vlan)
  } catch (error) {
    console.error('Error getting VLAN:', error)
    return NextResponse.json({ error: 'Failed to get VLAN' }, { status: 500 })
  }
} 