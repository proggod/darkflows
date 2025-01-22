import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET() {
  let connection;
  try {
    connection = await mysql.createConnection({
      socketPath: process.env.DATABASE_SOCKET,
      user: 'root',
      database: 'kea'
    });

    const [leases] = await connection.execute<mysql.RowDataPacket[]>(`
      SELECT 
        INET_NTOA(address) AS ip_address,
        HEX(hwaddr) AS mac_address,
        hostname AS device_name,
        expire,
        state
      FROM lease4
      WHERE (expire > NOW() OR expire IS NULL)
        AND state = 0
      ORDER BY expire
    `);

    const formattedLeases = leases.map((lease: any) => ({
      ip_address: lease.ip_address,
      mac_address: lease.mac_address && lease.mac_address.trim()
        ? lease.mac_address.match(/../g)?.join(':').toLowerCase() || 'N/A'
        : 'N/A',
      device_name: lease.device_name || 'N/A',
      expire: lease.expire ? new Date(lease.expire) : null,
      state: lease.state
    }));

    return NextResponse.json(formattedLeases);
  } catch (error) {
    console.error('Error fetching leases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch leases' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}