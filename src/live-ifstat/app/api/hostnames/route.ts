import { NextResponse, NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import mysql from 'mysql2/promise';
import { readConfig } from '@/lib/config';
import { getMacVendor } from '@/api/helpers/mac-vendor';

export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  let connection: mysql.Connection | null = null;

  try {
    const config = await readConfig();
    const dbConfig = config.Dhcp4['lease-database'];
    
    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name
    });

    // Get all active DHCP leases
    const [leases] = await connection.execute<mysql.RowDataPacket[]>(`
      SELECT 
        INET_NTOA(address) as ip,
        HEX(hwaddr) as mac,
        hostname
      FROM lease4
      WHERE state = 0
      ORDER BY address
    `);

    // Create a map of IPs to hostnames
    const hostnameMap: { [ip: string]: string } = {};
    
    // Process each lease
    for (const lease of leases) {
      if (lease.hostname) {
        hostnameMap[lease.ip] = lease.hostname;
      } else {
        // For devices without hostnames, use MAC vendor lookup
        const mac = lease.mac.match(/../g)?.join(':').toLowerCase();
        if (mac) {
          const vendor = await getMacVendor(mac);
          hostnameMap[lease.ip] = vendor || `Device (${mac})`;
        }
      }
    }

    return NextResponse.json(hostnameMap);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch hostnames' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
} 