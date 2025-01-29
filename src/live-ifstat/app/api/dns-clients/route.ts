import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { promises as fs } from 'fs';
import mysql from 'mysql2/promise'; // Added for MySQL support

const KEA_CONFIG_PATH = '/etc/kea/kea-dhcp4.conf';

interface KeaConfig {
  Dhcp4: {
    'lease-database': {
      type: string;
      name: string;
      user: string;
      password: string;
      host: string;
    };
    subnet4: Array<{
      reservations: Array<{
        'hw-address': string;
        'ip-address': string;
        hostname?: string;
      }>;
    }>;
  };
}

// Initialize SQLite database connection
let sqliteDb: Database;
async function getSqliteDb(): Promise<Database> {
  if (!sqliteDb) {
    sqliteDb = await open({
      filename: '/etc/pihole/pihole-FTL.db',
      driver: sqlite3.Database,
    });
  }
  return sqliteDb;
}

interface DnsQuery {
  lastSeen: number;
  ip: string;
}

// Read and clean Kea configuration file
async function readConfig(): Promise<KeaConfig> {
  try {
    const content = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
    // Remove any trailing commas before parsing
    const cleanContent = content
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas before } or ]
      .replace(/,(\s*})/g, '}') // Remove trailing commas before }
      .replace(/,(\s*\])/g, ']'); // Remove trailing commas before ]
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error parsing Kea config:', error);
    throw error;
  }
}

// Fetch hostnames from Kea and MySQL
async function getKeaHostnames(): Promise<Map<string, { name: string; isReserved: boolean; mac?: string }>> {
  const keaConfig = await readConfig(); // Use the readConfig function
  const dbConfig = keaConfig.Dhcp4['lease-database'];

  const connection = await mysql.createConnection({
    socketPath: '/var/run/mysqld/mysqld.sock',
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.name,
  });

  try {
    // Get reservations from MySQL hosts table
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
    const staticReservations = keaConfig.Dhcp4.subnet4[0].reservations;

    const hostnameMap = new Map<string, { name: string; isReserved: boolean; mac?: string }>();

    // Add static reservations from Kea config
    staticReservations.forEach((reservation) => {
      if (reservation['ip-address'] && reservation['hw-address']) {
        hostnameMap.set(reservation['ip-address'], {
          name: reservation.hostname || 'N/A',
          mac: reservation['hw-address'],
          isReserved: true,
        });
      }
    });

    // Add dynamic reservations from MySQL
    reservations.forEach((lease: mysql.RowDataPacket) => {
      if (lease.ip_address && lease.mac_address) {
        // Format MAC address with colons
        const mac = lease.mac_address.match(/.{2}/g)?.join(':');
        if (mac) {
          hostnameMap.set(lease.ip_address, {
            name: lease.device_name || 'N/A',
            isReserved: false,
            mac,
          });
        }
      }
    });

    return hostnameMap;
  } finally {
    await connection.end(); // Close the MySQL connection
  }
}

export async function GET() {
  try {
    const db = await getSqliteDb();
    const hostnameMap = await getKeaHostnames();

    // Query DNS data
    const queries = await db.all<DnsQuery[]>(`
      SELECT 
        timestamp as lastSeen,
        client as ip
      FROM queries 
      WHERE timestamp >= strftime('%s', 'now') - 86400
      GROUP BY client 
      ORDER BY timestamp DESC
    `);

    // Process and format the results
    const clients = queries.map((query) => ({
      ip: query.ip,
      lastSeen: query.lastSeen,
      name: hostnameMap.get(query.ip)?.name || 'N/A',
      mac: hostnameMap.get(query.ip)?.mac || 'N/A',
      isReserved: hostnameMap.get(query.ip)?.isReserved || false,
    }));

    // Filter out invalid IPs and sort by IP
    const filteredClients = clients
      .filter((client) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(client.ip))
      .sort((a, b) => {
        const aOctets = a.ip.split('.').map(Number);
        const bOctets = b.ip.split('.').map(Number);
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

