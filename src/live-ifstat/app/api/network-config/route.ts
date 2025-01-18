import { NextResponse } from 'next/server'

// Mock data for development
const mockConfig = {
  PRIMARY_EGRESS_BANDWIDTH: { value: '1000', unit: 'mbit' },
  PRIMARY_INGRESS_BANDWIDTH: { value: '1000', unit: 'mbit' },
  SECONDARY_EGRESS_BANDWIDTH: { value: '500', unit: 'mbit' },
  SECONDARY_INGRESS_BANDWIDTH: { value: '500', unit: 'mbit' }
}

export async function GET() {
  return NextResponse.json(mockConfig)
}

export async function POST(request: Request) {
  try {
    const config = await request.json()
    // In development, we'll just log the config
    console.log('Received config update:', config)
    return NextResponse.json({ message: 'Configuration updated successfully' })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
} 