import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { promises as fs } from 'fs';
import { NextRequest } from 'next/server';

// interface LeaseData {
//   ip_address: string;
//   mac_address: string | null;
//   device_name: string | null;
//   expire: Date | null;
//   state: number;
// }

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
  };
}

async function getKeaConfig(): Promise<KeaConfig> {
  const content = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

export async function GET(request: NextRequest) {
  let connection;
  try {
    const searchParams = request.nextUrl.searchParams;
    const subnetId = searchParams.get('subnetId') || '1';

    const keaConfig = await getKeaConfig();
    const dbConfig = keaConfig.Dhcp4['lease-database'];

    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name
    });

    // Get the correct identifier type for MAC addresses
    let macIdentifierType = 1; // Default value as fallback
    try {
      const [hwAddressType] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT type FROM host_identifier_type WHERE name = 'hw-address' OR name = 'hw_address' LIMIT 1"
      );
      
      if (hwAddressType.length > 0) {
        macIdentifierType = hwAddressType[0].type;
      }
    } catch {
      // Use default macIdentifierType if query fails
    }

    const [leases] = await connection.execute<mysql.RowDataPacket[]>(`
      SELECT 
        l.address AS ip_address,
        HEX(l.hwaddr) AS mac_address,
        l.hostname AS device_name,
        l.expire,
        l.state,
        l.subnet_id,
        h.hostname as reserved_hostname
      FROM lease4 l
      LEFT JOIN hosts h ON 
        UNHEX(HEX(l.hwaddr)) = h.dhcp_identifier 
        AND h.dhcp_identifier_type = ?
        AND h.dhcp4_subnet_id = ?
      WHERE (l.expire > NOW() OR l.expire IS NULL)
        AND l.state = 0
        AND l.subnet_id = ?
      ORDER BY l.expire
    `, [macIdentifierType, subnetId, subnetId]);

    const formattedLeases = leases.map((lease) => {
      // Convert IP address from number to string
      const ipAddress = lease.ip_address ? 
        ((lease.ip_address >>> 24) & 0xFF) + '.' +
        ((lease.ip_address >>> 16) & 0xFF) + '.' +
        ((lease.ip_address >>> 8) & 0xFF) + '.' +
        (lease.ip_address & 0xFF) : 'N/A';

      const formattedLease = {
        ip_address: ipAddress,
        mac_address: lease.mac_address && lease.mac_address.trim()
          ? lease.mac_address.match(/../g)?.join(':').toLowerCase() || 'N/A'
          : 'N/A',
        device_name: lease.reserved_hostname || lease.device_name || 'N/A',
        expire: lease.expire ? new Date(lease.expire) : null,
        state: lease.state,
        is_reserved: !!lease.reserved_hostname
      };

      return formattedLease;
    });

    return NextResponse.json(formattedLeases);
  } catch (error) {
    console.error('Error fetching leases:', error);
    return NextResponse.json({ error: 'Failed to fetch leases' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}