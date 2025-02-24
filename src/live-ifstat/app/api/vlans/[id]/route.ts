import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { VLANConfig } from '@/types/dashboard'
import { requireAuth } from '@/lib/auth'
import { NextRequest } from 'next/server'

const VLANS_FILE = '/etc/darkflows/vlans.json'

async function readVLANs(): Promise<VLANConfig[]> {
  try {
    const data = await readFile(VLANS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeVLANs(vlans: VLANConfig[]): Promise<void> {
  await writeFile(VLANS_FILE, JSON.stringify(vlans, null, 2))
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    const vlans = await readVLANs()
    const updatedVlan = await request.json()
    const { id } = await params
    const vlanId = parseInt(id)

    console.log('Updating VLAN:', {
      vlanId,
      existingVlans: vlans,
      updatedVlan
    })

    const index = vlans.findIndex(v => v.id === vlanId)
    if (index === -1) {
      console.log('VLAN not found:', vlanId)
      return NextResponse.json({ error: 'VLAN not found' }, { status: 404 })
    }

    // Preserve created date and update modified date
    updatedVlan.modified = new Date()
    updatedVlan.created = vlans[index].created
    
    vlans[index] = updatedVlan
    await writeVLANs(vlans)

    return NextResponse.json(updatedVlan)
  } catch (error) {
    console.error('Error updating VLAN:', error)
    return NextResponse.json({ error: 'Failed to update VLAN' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  try {
    const { id } = await params
    const vlanId = parseInt(id)
    const vlans = await readVLANs()
    
    const index = vlans.findIndex(v => v.id === vlanId)
    if (index === -1) {
      return NextResponse.json({ error: 'VLAN not found' }, { status: 404 })
    }

    vlans.splice(index, 1)
    await writeVLANs(vlans)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting VLAN:', error)
    return NextResponse.json({ error: 'Failed to delete VLAN' }, { status: 500 })
  }
} 