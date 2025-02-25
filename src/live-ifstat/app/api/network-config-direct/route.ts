import { NextResponse, NextRequest } from 'next/server';
import { readFile } from 'fs/promises';

// No authentication check to rule that out as an issue
export async function GET(request: NextRequest) {
  try {
    console.log("🚨 DIRECT CONFIG API CALLED 🚨");
    console.log("URL:", request.url);
    
    // Read config file directly
    const content = await readFile('/etc/darkflows/d_network.cfg', 'utf-8');
    console.log("📄 Raw config content:", content.substring(0, 100) + "...");
    
    // Parse interfaces manually 
    const primaryMatch = content.match(/PRIMARY_INTERFACE="([^"]*)"/)
    const secondaryMatch = content.match(/SECONDARY_INTERFACE="([^"]*)"/)
    const internalMatch = content.match(/INTERNAL_INTERFACE="([^"]*)"/)
    
    const config = {
      PRIMARY_INTERFACE: primaryMatch ? primaryMatch[1] : '',
      SECONDARY_INTERFACE: secondaryMatch ? secondaryMatch[1] : '',
      INTERNAL_INTERFACE: internalMatch ? internalMatch[1] : '',
      _timestamp: new Date().toISOString(),
      _random: Math.random()
    };
    
    console.log("⚡ DIRECT CONFIG RESULT:", config);
    
    return new NextResponse(JSON.stringify(config), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("❌ DIRECT CONFIG ERROR:", error);
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
} 