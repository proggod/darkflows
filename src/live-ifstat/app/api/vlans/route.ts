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

// Add helper to apply bandwidth shaping
async function applyBandwidthShaping(vlanId: number): Promise<void> {
  console.log(`Applying bandwidth shaping for VLAN ID: ${vlanId}`)
  try {
    const { stdout, stderr } = await execAsync(`${NFTABLES_SHAPING_SCRIPT} ${vlanId}`)
    console.log(`Shaping script stdout: ${stdout}`)
    if (stderr) {
      console.error(`Shaping script stderr: ${stderr}`)
    }
  } catch (error) {
    console.error(`Error running nftables shaping script: ${error}`)
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
  await execAsync(UPDATE_SCRIPT)
}

export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse
  
  try {
    const vlans = await readVLANs()
    return NextResponse.json(vlans)
  } catch (error) {
    console.error('Error reading VLANs:', error)
    return NextResponse.json({ error: 'Failed to read VLANs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    const newVlan: VLANConfig = await request.json()
    const vlans = await readVLANs()
    
    // Validate VLAN ID uniqueness
    if (vlans.some(v => v.id === newVlan.id)) {
      return NextResponse.json({ error: 'VLAN ID already exists' }, { status: 400 })
    }

    // Validate bandwidth formats if provided
    if (newVlan.egressBandwidth && !isValidBandwidth(newVlan.egressBandwidth)) {
      return NextResponse.json({ error: 'Invalid egress bandwidth format' }, { status: 400 })
    }
    if (newVlan.ingressBandwidth && !isValidBandwidth(newVlan.ingressBandwidth)) {
      return NextResponse.json({ error: 'Invalid ingress bandwidth format' }, { status: 400 })
    }

    // Add timestamps
    newVlan.created = new Date()
    newVlan.modified = new Date()
    
    vlans.push(newVlan)
    await writeVLANs(vlans)
    
    // Apply bandwidth shaping if either egress or ingress is set
    if (newVlan.egressBandwidth || newVlan.ingressBandwidth) {
      await applyBandwidthShaping(newVlan.id)
    }
    
    return NextResponse.json(newVlan)
  } catch (error) {
    console.error('Error creating VLAN:', error)
    return NextResponse.json({ error: 'Failed to create VLAN' }, { status: 500 })
  }
}

// Add PUT handler for updating VLANs
export async function PUT(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    const updatedVlan: VLANConfig = await request.json()
    const vlans = await readVLANs()
    
    // Find the index of the VLAN to update
    const index = vlans.findIndex(v => v.id === updatedVlan.id)
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
    const bandwidthChanged = 
      vlans[index].egressBandwidth !== updatedVlan.egressBandwidth ||
      vlans[index].ingressBandwidth !== updatedVlan.ingressBandwidth

    // Update timestamps
    updatedVlan.created = vlans[index].created
    updatedVlan.modified = new Date()
    
    // Update the VLAN in the array
    vlans[index] = updatedVlan
    await writeVLANs(vlans)
    
    // Apply bandwidth shaping if bandwidth settings changed
    if (bandwidthChanged) {
      await applyBandwidthShaping(updatedVlan.id)
    }
    
    return NextResponse.json(updatedVlan)
  } catch (error) {
    console.error('Error updating VLAN:', error)
    return NextResponse.json({ error: 'Failed to update VLAN' }, { status: 500 })
  }
}

// Add DELETE handler for removing VLANs
export async function DELETE(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    // Extract VLAN ID from URL or request body
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'VLAN ID is required' }, { status: 400 })
    }

    const vlans = await readVLANs()
    const vlanId = parseInt(id, 10)
    
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