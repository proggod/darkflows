import { NextResponse } from 'next/server'
import { isLoggedIn } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET() {
  console.log('Auth check endpoint called')
  const authenticated = await isLoggedIn()
  console.log('Auth check result:', authenticated)
  return NextResponse.json({ authenticated })
} 