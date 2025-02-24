import { NextResponse, NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import mysql from 'mysql2/promise';
import { lookupHostnames } from '@/lib/hostname-lookup';
import { DnsClient } from '@/types/dns';

export async function GET(request: NextRequest) {
  
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  let connection: mysql.Connection | undefined;

  try {
    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: 'root',
      database: 'dns_logs'
    });
    

    const [queries] = await connection.execute<mysql.RowDataPacket[]>(`
      SELECT 
        UNIX_TIMESTAMP(ts) as lastSeen,
        client_ip as ip
      FROM dns_queries 
      WHERE ts >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY client_ip 
      ORDER BY ts DESC
    `);
    

    const hostInfoMap = await lookupHostnames(queries.map(q => q.ip));
    

    const clients: DnsClient[] = queries
      .map(query => {
        const hostInfo = hostInfoMap.get(query.ip);
        if (!hostInfo) return null;

        return {
          ip: query.ip,
          lastSeen: query.lastSeen,
          name: hostInfo.name,
          mac: hostInfo.mac!,
          isReserved: hostInfo.isReserved,
          status: hostInfo.isReserved ? 'reserved' : 'dynamic'
        };
      })
      .filter((client): client is DnsClient => 
        client !== null && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(client.ip)
      )
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



    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error in DNS clients API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DNS clients' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PUT(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  // ... existing code ...
}

export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  // ... rest of the code ...
}

