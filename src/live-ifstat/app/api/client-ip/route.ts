import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for')
    let clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1'
    
    // Convert IPv4-mapped IPv6 to IPv4
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7)
    }
    
    return NextResponse.json({ 
      ip: clientIp,
      rawForwardedFor: forwardedFor || '127.0.0.1',
      allIps: forwardedFor ? forwardedFor.split(',').map(ip => ip.trim()) : ['127.0.0.1']
    })
  } catch (error: unknown) {
    console.error('Error in client-ip route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
} 