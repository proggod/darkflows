import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import mysql from 'mysql2/promise';
import { getMacVendor } from '../helpers/mac-vendor';
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

interface DnsClient {
  ip: string;
  name: string;
  status: 'static' | 'reserved' | 'dynamic';
}

async function readKeaConfig(): Promise<KeaConfig> {
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

async function getKeaHostnames(): Promise<Map<string, { name: string, isReserved: boolean, mac?: string }>> {
  const connection = await mysql.createConnection({
    socketPath: process.env.DATABASE_SOCKET,
    user: 'root',
    database: 'kea'
  });

  try {
    // Get active leases with their IP addresses and MAC addresses
    const [leases] = await connection.execute<mysql.RowDataPacket[]>(`
      SELECT 
        INET_NTOA(address) AS ip_address,
        LOWER(HEX(hwaddr)) AS mac_address,
        hostname AS device_name,
        state
      FROM lease4
      WHERE (expire > NOW() OR expire IS NULL)
        AND state = 0
        AND hwaddr IS NOT NULL
    `);

    // Get reservations from hosts table
    const [reservations] = await connection.execute<mysql.RowDataPacket[]>(`
      SELECT 
        INET_NTOA(ipv4_address) AS ip_address,
        LOWER(HEX(dhcp_identifier)) AS mac_address,
        hostname AS device_name
      FROM hosts
      WHERE ipv4_address IS NOT NULL
        AND dhcp_identifier_type = 0
        AND dhcp_identifier IS NOT NULL
    `);

    // Get static reservations from Kea config
    const keaConfig = await readKeaConfig();
    const staticReservations = keaConfig.Dhcp4.subnet4[0].reservations;

    const hostnameMap = new Map<string, { name: string, isReserved: boolean, mac?: string }>();

    // Format MAC addresses and add leases
    leases.forEach((lease: any) => {
      if (lease.ip_address && lease.mac_address) {
        // Format MAC address with colons
        const mac = lease.mac_address.match(/.{2}/g)?.join(':');
        if (mac) {
          hostnameMap.set(lease.ip_address, { 
            name: lease.device_name || 'N/A',
            isReserved: false,
            mac
          });
        }
      }
    });

    // Format MAC addresses and add/update reservations
    reservations.forEach((reservation: any) => {
      if (reservation.ip_address && reservation.mac_address) {
        // Format MAC address with colons
        const mac = reservation.mac_address.match(/.{2}/g)?.join(':');
        if (mac) {
          hostnameMap.set(reservation.ip_address, { 
            name: reservation.device_name || 'N/A',
            isReserved: true,
            mac
          });
        }
      }
    });

    // Add static reservations from Kea config
    staticReservations.forEach((reservation: any) => {
      const mac = reservation['hw-address'].toLowerCase();
      hostnameMap.set(reservation['ip-address'], {
        name: reservation.hostname || 'N/A',
        isReserved: true,
        mac
      });
    });

    // Debug log to see what we're getting
    console.log('Sample data:', {
      sampleLease: leases[0],
      sampleReservation: reservations[0],
      sampleStaticReservation: staticReservations[0],
      totalLeases: leases.length,
      totalReservations: reservations.length,
      totalStaticReservations: staticReservations.length
    });

    return hostnameMap;
  } finally {
    await connection.end();
  }
}

export async function GET() {
  try {
    const sqliteDb = await getSqliteDb();
    
    // Get DNS queries from last hour
    const dnsClients = await sqliteDb.all<DnsQuery[]>(`
      SELECT
        MAX(timestamp) as lastSeen,
        client as ip
      FROM queries
      WHERE timestamp >= strftime('%s', 'now', '-1 hour')
      GROUP BY client
      ORDER BY lastSeen DESC
    `);

    // Get hostnames from Kea
    const hostnameMap = await getKeaHostnames();

    // Format clients with vendor lookup for unknown names
    const clients = await Promise.all(dnsClients.map(async entry => {
      const keaInfo = hostnameMap.get(entry.ip);
      let name = keaInfo?.name || 'N/A';
      let status = keaInfo ? (keaInfo.isReserved ? 'reserved' : 'dynamic') : 'static';

      // Debug log for this IP
      console.log('Processing IP:', {
        ip: entry.ip,
        initialName: name,
        hasMac: !!keaInfo?.mac,
        mac: keaInfo?.mac
      });

      // If no name but we have a MAC address, try to get vendor name
      if (name === 'N/A' && keaInfo?.mac) {
        try {
          const vendor = await getMacVendor(keaInfo.mac);
          console.log('Vendor lookup result:', {
            ip: entry.ip,
            mac: keaInfo.mac,
            vendor
          });
          if (vendor !== 'Unknown') {
            name = vendor;
          }
        } catch (error) {
          console.error('Error looking up vendor:', {
            ip: entry.ip,
            mac: keaInfo.mac,
            error
          });
        }
      }

      return {
        ip: entry.ip,
        name,
        status,
        mac: keaInfo?.mac
      };
    }));

    // Log final results
    console.log('Final results:', clients.map(c => ({
      ip: c.ip,
      name: c.name,
      status: c.status,
      mac: c.mac
    })));

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching DNS clients:', {
      error: error instanceof Error ? error.message : error,
      dbPath: process.env.PIHOLE_DB_PATH,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch DNS clients',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}