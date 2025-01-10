import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import util from 'util'

const execAsync = util.promisify(exec)
const SWITCH_SCRIPT = '/usr/local/darkflows/bin/switch_gateway.sh'

export async function POST(request: Request) {
  try {
    const { type } = await request.json()
    await execAsync(`${SWITCH_SCRIPT} ${type}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gateway switch error:', error);
    return NextResponse.json({ error: 'Failed to switch gateway', details: String(error) }, { status: 500 })
  }
} 