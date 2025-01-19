import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET() {
  let connection;
  try {
    connection = await mysql.createConnection({
      socketPath: process.env.DATABASE_SOCKET,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME
    });

    const [rows] = await connection.execute(`
      SELECT 
        INET_NTOA(l4.address) AS ip_address, 
        HEX(l4.hwaddr) AS mac_address, 
        l4.hostname AS device_name, 
        l4.expire, 
        ls.name AS state_name 
      FROM 
        lease4 l4 
      JOIN 
        lease_state ls ON l4.state = ls.state 
      WHERE 
        (l4.expire > NOW() OR l4.expire IS NULL)
        AND l4.state = 0
      ORDER BY 
        l4.expire
    `) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    const leases = rows.map((row) => ({
      ip_address: row.ip_address,
      mac_address: row.mac_address && row.mac_address.trim()
        ? row.mac_address.match(/../g).join(':').toLowerCase()
        : 'N/A',
      device_name: row.device_name || 'N/A',
      expire: row.expire ? new Date(row.expire) : null,
      state_name: row.state_name
    }));

    return NextResponse.json(leases);
  } catch (error) {
    console.error('Error fetching leases:', error);
    return NextResponse.json({ error: 'Failed to fetch leases' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
} 