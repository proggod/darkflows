import { promises as fs } from 'fs';

const MAC_DB_PATH = '/usr/share/nmap/nmap-mac-prefixes';
let manufacturerCache: Map<string, string> | null = null;

async function loadManufacturerDb(): Promise<Map<string, string>> {
  if (manufacturerCache) {
    return manufacturerCache;
  }

  const map = new Map<string, string>();
  try {
    try {
      await fs.access(MAC_DB_PATH);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      return map;
    }

    const content = await fs.readFile(MAC_DB_PATH, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [prefix, ...nameParts] = line.split('\t');
        if (prefix && nameParts.length > 0) {
          map.set(prefix.toLowerCase(), nameParts.join(' '));
        }
      }
    }
    
    manufacturerCache = map;
    return map;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return map;
  }
}

export async function getManufacturer(mac: string): Promise<string | null> {
  try {
    // Clean the MAC address
    const cleanMac = mac.toLowerCase().replace(/[^a-f0-9]/g, '');
    if (cleanMac.length < 6) {
      return null;
    }

    // Get the first 6 characters (OUI)
    const prefix = cleanMac.substring(0, 6);
    
    // Load the manufacturer database
    const manufacturers = await loadManufacturerDb();
    
    // Look up the manufacturer
    return manufacturers.get(prefix) || null;
  } catch (_error) {
    console.error('Error getting manufacturer:', _error);
    return null;
  }
} 