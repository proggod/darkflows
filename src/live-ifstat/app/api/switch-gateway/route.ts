import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  try {
    const { type } = await request.json()
    
    if (type !== 'PRIMARY' && type !== 'SECONDARY') {
      return NextResponse.json(
        { error: 'Invalid gateway type. Must be PRIMARY or SECONDARY.' },
        { status: 400 }
      )
    }

    await execAsync(`/usr/local/darkflows/bin/switch_gateway.sh ${type}`)
    return NextResponse.json({ message: `Switched to ${type} gateway` })
  } catch (error) {
    console.error('Error switching gateway:', error)
    return NextResponse.json(
      { error: 'Failed to switch gateway' },
      { status: 500 }
    )
  }
} 