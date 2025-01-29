import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import mysql from 'mysql2/promise';
import { getMacVendor } from '../helpers/mac-vendor';
import { promises as fs } from 'fs';


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
      driver: sqlite3.Database
    });
  }
  return sqliteDb;
}

interface DnsQuery {
  lastSeen: number;
  ip: string;
}

async function getKeaConfig(): Promise<KeaConfig> {
  const content = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

async function getKeaHostnames(): Promise<Map<string, { name: string, isReserved: boolean, mac?: string }>> {
  const keaConfig = await getKeaConfig();
  const dbConfig = keaConfig.Dhcp4['lease-database'];
  
  const connection = await mysql.createConnection({
    socketPath: '/var/run/mysqld/mysqld.sock',
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.name
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
    const keaConfig = await getKeaConfig();
    const staticReservations = keaConfig.Dhcp4.subnet4[0].reservations;

    const hostnameMap = new Map<string, { name: string, isReserved: boolean, mac?: string }>();

    // Format MAC addresses and add leases
    leases.forEach((lease: mysql.RowDataPacket) => {
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
    reservations.forEach((reservation: mysql.RowDataPacket) => {
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
    staticReservations.forEach((reservation: { 'hw-address': string; 'ip-address': string; hostname?: string }) => {
      const mac = reservation['hw-address'].toLowerCase();
      hostnameMap.set(reservation['ip-address'], {
        name: reservation.hostname || 'N/A',
        isReserved: true,
        mac
      });
    });

    // Debug log to see what we're getting
  //  console.log('Sample data:', {
  //    sampleLease: leases[0],
  //    sampleReservation: reservations[0],
  //    sampleStaticReservation: staticReservations[0],
  //    totalLeases: leases.length,
  //    totalReservations: reservations.length,
  //    totalStaticReservations: staticReservations.length
  //  });

    return hostnameMap;
  } finally {
    await connection.end();
  }
}

export async function GET(request: Request) {
  try {
    const sqliteDb = await getSqliteDb();
    
    // Get hours from query parameter, default to 1 if not specified
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours') || '1', 10);
    
    // Get DNS queries from specified time period
    const dnsClients = await sqliteDb.all<DnsQuery[]>(`
      SELECT
        MAX(timestamp) as lastSeen,
        client as ip
      FROM queries
      WHERE timestamp >= strftime('%s', 'now', '-${hours} hours')
      GROUP BY client
      ORDER BY lastSeen DESC
    `);

    // Get hostnames from Kea
    const hostnameMap = await getKeaHostnames();

    // Create a Set of IPs we've already processed
    const processedIPs = new Set<string>();

    // Format clients with vendor lookup for unknown names
    const clients = await Promise.all(dnsClients.map(async entry => {
      processedIPs.add(entry.ip);
      const keaInfo = hostnameMap.get(entry.ip);
      let name = keaInfo?.name || 'N/A';
      const status = keaInfo ? (keaInfo.isReserved ? 'reserved' : 'dynamic') : 'static';
      const mac = keaInfo?.mac || null;

      // Try to get vendor info if we have a MAC address
      if (mac && (name === 'N/A' || name === '')) {
        const vendor = await getMacVendor(mac);
        if (vendor) {
          name = `Unknown ${vendor} Device`;
        } else {
          // If no vendor info, use MAC address as name
          name = mac;
        }
      }

      return {
        ip: entry.ip,
        name,
        mac,
        status,
        lastSeen: entry.lastSeen
      };
    }));

    // Add any reserved IPs that haven't made DNS queries
    const reservedEntries = Array.from(hostnameMap.entries());
    for (const [ip, info] of reservedEntries) {
      if (!processedIPs.has(ip) && info.isReserved) {
        let name = info.name;
        const mac = info.mac || null;
        
        // Try to get vendor info if we have a MAC address
        if (mac && (name === 'N/A' || name === '')) {
          const vendor = await getMacVendor(mac);
          if (vendor) {
            name = `Unknown ${vendor} Device`;
          } else {
            // If no vendor info, use MAC address as name
            name = mac;
          }
        }

        clients.push({
          ip,
          name,
          mac,
          status: 'reserved',
          lastSeen: 0
        });
      }
    }

    // Filter out clients without MAC addresses
    const filteredClients = clients.filter(client => client.mac !== null);

    return NextResponse.json(filteredClients);
  } catch (error: unknown) {
    console.error('Error fetching DNS clients:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}