import { NextResponse } from 'next/server'

// Mock data for development
const mockStatus = {
  active: 'PRIMARY'
}

export async function GET() {
  return NextResponse.json(mockStatus)
} 