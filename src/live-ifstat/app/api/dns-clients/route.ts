import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { promises as fs } from 'fs';

const KEA_CONFIG_PATH = '/etc/kea/kea-dhcp4.conf';

interface KeaConfig {
  Dhcp4: {
    subnet4: [{
      reservations: {
        'ip-address': string;
        'hw-address': string;
        hostname?: string;
      }[];
    }];
  };
}

// Initialize SQLite database connection
let sqliteDb: Database;
async function getSqliteDb(): Promise<Database> {
  if (!sqliteDb) {
    if (!process.env.PIHOLE_DB_PATH) {
      throw new Error('PIHOLE_DB_PATH environment variable is required');
    }
    sqliteDb = await open({
      filename: process.env.PIHOLE_DB_PATH,
      driver: sqlite3.Database
    });
  }
  return sqliteDb;
}

interface DnsQuery {
  lastSeen: number;
  ip: string;
}

async function readConfig(): Promise<KeaConfig> {
  try {
    const content = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
    // Remove any trailing commas before parsing
    const cleanContent = content
      .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas before } or ]
      .replace(/,(\s*})/g, '}')       // Remove trailing commas before }
      .replace(/,(\s*\])/g, ']');     // Remove trailing commas before ]
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error parsing Kea config:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const db = await getSqliteDb();
    const config = await readConfig();
    
    // Add null checks and provide default values
    const reservations = config?.Dhcp4?.subnet4?.[0]?.reservations || [];
    const hostnameMap = new Map();

    // Safely process reservations
    reservations.forEach(reservation => {
      if (reservation['ip-address'] && reservation['hw-address']) {
        hostnameMap.set(reservation['ip-address'], {
          name: reservation.hostname || 'N/A',
          mac: reservation['hw-address'],
          isReserved: true
        });
      }
    });

    // Query DNS data
    const queries = await db.all<DnsQuery[]>(`
      SELECT 
        timestamp as lastSeen,
        client as ip  -- Changed from 'ip' to 'client' which is the correct column name
      FROM queries 
      WHERE timestamp >= strftime('%s', 'now') - 86400
      GROUP BY client 
      ORDER BY timestamp DESC
    `);

    // Process and format the results
    const clients = queries.map(query => ({
      ip: query.ip,
      lastSeen: query.lastSeen,
      name: hostnameMap.get(query.ip)?.name || 'N/A',
      mac: hostnameMap.get(query.ip)?.mac || 'N/A',
      isReserved: hostnameMap.get(query.ip)?.isReserved || false
    }));

    // Filter out invalid IPs and sort by IP
    const filteredClients = clients
      .filter(client => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(client.ip))
      .sort((a, b) => {
        const aOctets = a.ip.split('.').map(Number);
        const bOctets = b.ip.split('.').map(Number);q
        for (let i = 0; i < 4; i++) {
          if (aOctets[i] !== bOctets[i]) {
            return aOctets[i] - bOctets[i];
          }
        }
        return 0;
      });

    return NextResponse.json(filteredClients);
  } catch (error) {
    console.error('Error fetching DNS clients:', error);
    // Return empty array instead of failing
    return NextResponse.json([]);
  }
}

export async function PUT() {
  // ... existing code ...
}