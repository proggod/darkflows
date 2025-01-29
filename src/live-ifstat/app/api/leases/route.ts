import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { readConfig } from '@/lib/config';

// interface LeaseData {
//   ip_address: string;
//   mac_address: string | null;
//   device_name: string | null;
//   expire: Date | null;
//   state: number;
// }

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

    // Get reservations to update hostnames
    const config = await readConfig();
    const reservations = config?.Dhcp4?.subnet4?.[0]?.reservations || [];

    const formattedLeases = leases.map((lease) => {
      const formattedLease = {
        ip_address: lease.ip_address,
        mac_address: lease.mac_address && lease.mac_address.trim()
          ? lease.mac_address.match(/../g)?.join(':').toLowerCase() || 'N/A'
          : 'N/A',
        device_name: lease.device_name || 'N/A',
        expire: lease.expire ? new Date(lease.expire) : null,
        state: lease.state,
        is_reserved: false
      };

      // Check if this lease has a reservation and update hostname
      const reservation = reservations.find(r => 
        r['ip-address'] === formattedLease.ip_address || 
        r['hw-address']?.toLowerCase() === formattedLease.mac_address.toLowerCase()
      );

      if (reservation) {
        return {
          ...formattedLease,
          device_name: reservation.hostname || formattedLease.device_name,
          is_reserved: true
        };
      }

      return formattedLease;
    });

    return NextResponse.json(formattedLeases);
  } catch (error) {
    console.error('Error fetching leases:', error);
    // Return empty array instead of failing
    return NextResponse.json([]);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}