import { NextResponse } from 'next/server'
import { isLoggedIn } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const authenticated = await isLoggedIn()
    return NextResponse.json({ authenticated })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 500 }
    )
  }
} 