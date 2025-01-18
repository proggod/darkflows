import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { type } = await request.json()
    // In development, we'll just log the switch request
    console.log('Switching to gateway:', type)
    return NextResponse.json({ message: `Switched to ${type} gateway` })
  } catch (error) {
    console.error('Error switching gateway:', error)
    return NextResponse.json(
      { error: 'Failed to switch gateway' },
      { status: 500 }
    )
  }
} 