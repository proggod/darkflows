import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { VLANConfig } from '@/types/dashboard'
import { requireAuth } from '@/lib/auth'
import { NextRequest } from 'next/server'

const VLANS_FILE = '/etc/darkflows/vlans.json'

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

    // Add timestamps
    newVlan.created = new Date()
    newVlan.modified = new Date()
    
    vlans.push(newVlan)
    await writeVLANs(vlans)
    
    return NextResponse.json(newVlan)
  } catch (error) {
    console.error('Error creating VLAN:', error)
    return NextResponse.json({ error: 'Failed to create VLAN' }, { status: 500 })
  }
} 