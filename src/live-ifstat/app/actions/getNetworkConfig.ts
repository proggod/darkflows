'use server'

import { readFile } from 'fs/promises';

export async function getNetworkConfig() {
  try {
    console.log("🔍 SERVER ACTION: getNetworkConfig called");
    
    const content = await readFile('/etc/darkflows/d_network.cfg', 'utf-8');
    console.log("📄 Config file read successfully");
    
    // Parse interfaces manually
    const primaryMatch = content.match(/PRIMARY_INTERFACE="([^"]*)"/)
    const secondaryMatch = content.match(/SECONDARY_INTERFACE="([^"]*)"/)
    const internalMatch = content.match(/INTERNAL_INTERFACE="([^"]*)"/)
    
    const config = {
      PRIMARY_INTERFACE: primaryMatch ? primaryMatch[1] : '',
      SECONDARY_INTERFACE: secondaryMatch ? secondaryMatch[1] : '',
      INTERNAL_INTERFACE: internalMatch ? internalMatch[1] : '',
      _timestamp: new Date().toISOString()
    };
    
    console.log("🔄 SERVER ACTION CONFIG:", config);
    return { success: true, config };
  } catch (error) {
    console.error("❌ SERVER ACTION ERROR:", error);
    return { success: false, error: String(error) };
  }
} 