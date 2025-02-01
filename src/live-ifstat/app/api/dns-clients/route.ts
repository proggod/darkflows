import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSqliteDb } from '@/lib/db';
import { lookupHostnames } from '@/lib/hostname-lookup';
import { DnsClient } from '@/types/dns';

export async function GET() {
  // Check authentication first
  const authResponse = await requireAuth();
  if (authResponse) return authResponse;

  try {
    const db = await getSqliteDb();
    
    // Get all DNS queries
    const queries = await db.all<Array<{
      lastSeen: number;
      ip: string;
    }>>(`
      SELECT 
        timestamp as lastSeen,
        client as ip
      FROM queries 
      WHERE timestamp >= strftime('%s', 'now') - 86400
      GROUP BY client 
      ORDER BY timestamp DESC
    `);

    // Look up all hostnames at once
    const hostInfoMap = await lookupHostnames(queries.map(q => q.ip));

    // Map results
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
    console.error('Error fetching DNS clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DNS clients' },
      { status: 500 }
    );
  }
}

export async function PUT() {
  // ... existing code ...
}

