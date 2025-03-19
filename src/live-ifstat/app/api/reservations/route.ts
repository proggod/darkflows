import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAuth } from '@/lib/auth';
import mysql from 'mysql2/promise';
import { readConfig } from '@/lib/config';
import { syncAllSystems } from '@/lib/sync';


const execAsync = promisify(exec);
const DNS_MANAGER_SCRIPT = '/usr/local/darkflows/bin/unbound-dns-manager.py';

const getDbConnection = async () => {
  try {
    const config = await readConfig();
    const dbConfig = config.Dhcp4['lease-database'];
    
    const connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name
    });
    
    return connection;
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

async function syncDNSEntry(ip: string, hostname: string, shouldDelete = false, subnetId: string = '1') {
  try {
    const command = shouldDelete 
      ? `${DNS_MANAGER_SCRIPT} remove ${hostname} ${subnetId}`
      : `${DNS_MANAGER_SCRIPT} add ${ip} ${hostname} ${subnetId}`;
    console.log(`[DNS Manager] Executing command: ${command}`);
    await execAsync(command);
    console.log(`[DNS Manager] Successfully ${shouldDelete ? 'removed' : 'added'} DNS entry for ${shouldDelete ? hostname : `${ip} (${hostname})`} in VLAN ${subnetId}`);
  } catch (error) {
    console.error('[DNS Manager] Error:', error);
    throw new Error(`Failed to sync DNS entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  let connection;
  try {
    connection = await getDbConnection();
    
    // Get the subnet ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const subnetId = searchParams.get('subnetId') || '1'; // Default to 1 if not specified
    
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
    
    // Query the hosts table with the correct identifier type and subnet ID
    const query = `
      SELECT 
        INET_NTOA(ipv4_address) as 'ip-address',
        LOWER(HEX(dhcp_identifier)) as 'hw-address-hex',
        hostname
      FROM hosts
      WHERE dhcp_identifier_type = ?
        AND dhcp4_subnet_id = ?
    `;
    
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(query, [macIdentifierType, subnetId]);
    
    // Format MAC addresses with colons
    const reservations = rows.map(row => {
      const formattedMac = (row['hw-address-hex'].match(/.{1,2}/g) || []).join(':').toLowerCase();
      return {
        'ip-address': row['ip-address'],
        'hw-address': formattedMac,
        hostname: row.hostname || ''
      };
    });
    
    const response = NextResponse.json(reservations);
    
    // Add no-cache headers explicitly
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  let connection;
  try {
    const reservation = await request.json();
    
    // Get the subnet ID from the request
    const subnetId = reservation.subnetId || '1';
    const subnetCidr = reservation.subnetCidr;
    
    // Validate the IP is in a valid subnet
    const validSubnetId = await getSubnetIdForIp(reservation['ip-address'], subnetId, subnetCidr);
    if (validSubnetId === null) {
      return NextResponse.json({ error: 'IP address is not in any configured subnet' }, { status: 400 });
    }
    
    // Check if the IP is in the correct subnet for the selected VLAN
    if (validSubnetId.toString() !== subnetId) {
      return NextResponse.json({ error: 'IP address is not in the selected VLAN subnet' }, { status: 400 });
    }
    
    connection = await getDbConnection();
    
    // Get correct identifier type for MAC addresses
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
    
    // Convert MAC to binary format for database
    const macHex = reservation['hw-address'].replace(/:/g, '');
    const ipNumber = ipToNumber(reservation['ip-address']);
    
    // Check if reservation already exists
    const [existing] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ?',
      [macHex, macIdentifierType]
    );
    
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A reservation with this MAC address already exists' }, { status: 409 });
    }
    
    // Insert new reservation
    await connection.execute(
      'INSERT INTO hosts (dhcp_identifier, dhcp_identifier_type, ipv4_address, hostname, dhcp4_subnet_id) VALUES (UNHEX(?), ?, ?, ?, ?)',
      [macHex, macIdentifierType, ipNumber, reservation.hostname || null, subnetId]
    );
    
    // If hostname is provided, add DNS entry
    if (reservation.hostname) {
      await syncDNSEntry(reservation['ip-address'], reservation.hostname, false, subnetId.toString());
    }
    
    // Sync all systems
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding reservation:', error);
    return NextResponse.json({ error: 'Failed to add reservation' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function DELETE(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  let connection;
  try {
    const { ip, mac, subnetId = '1' } = await request.json();
    
    connection = await getDbConnection();
    
    // Get correct identifier type for MAC addresses
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
    
    // Convert MAC to binary format for database
    const macHex = mac.replace(/:/g, '');
    
    // Get hostname before deleting
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT hostname FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ?',
      [macHex, macIdentifierType]
    );
    
    const hostname = rows[0]?.hostname;
    
    // Delete the reservation
    await connection.execute(
      'DELETE FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ?',
      [macHex, macIdentifierType]
    );
    
    // If there was a hostname, remove DNS entry
    if (hostname) {
      await syncDNSEntry(ip, hostname, true, subnetId);
    }
    
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PUT(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  let connection;
  try {
    const { originalIp, ...reservation } = await request.json();
    
    // Validate the IP is in a valid subnet
    const subnetId = await getSubnetIdForIp(reservation['ip-address'], reservation.subnetId, reservation.subnetCidr);
    if (subnetId === null) {
      return NextResponse.json({ error: 'IP address is not in any configured subnet' }, { status: 400 });
    }
    
    // Convert MAC and IPs to binary format for database
    const macHex = reservation['hw-address'].replace(/:/g, '');
    const newIpNumber = ipToNumber(reservation['ip-address']);
    
    connection = await getDbConnection();
    
    // Get correct identifier type for MAC addresses
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
    
    // Get existing reservation
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT hostname FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ?',
      [macHex, macIdentifierType]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }
    
    const existingHostname = rows[0].hostname;
    
    // If IP address changed and we have a hostname, update DNS
    if (originalIp !== reservation['ip-address'] && existingHostname) {
      // Remove old DNS entry
      await syncDNSEntry(originalIp, existingHostname, true, subnetId.toString());
      // Add new DNS entry
      const ipAddress = reservation['ip-address'] ?? '';
      await syncDNSEntry(ipAddress, reservation.hostname ?? existingHostname, false, subnetId.toString());
    }
    
    // Update the reservation
    await connection.execute(
      'UPDATE hosts SET ipv4_address = ?, hostname = ?, dhcp4_subnet_id = ? WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ?',
      [newIpNumber, reservation.hostname || null, subnetId, macHex, macIdentifierType]
    );
    
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Helper function to convert IP to number for comparison
function ipToNumber(ip: string): number {
  return ip.split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// Helper function to determine subnet ID based on IP address
async function getSubnetIdForIp(ip: string | undefined, subnetId: string, subnetCidr: string): Promise<number | null> {
  if (!ip) return null;
  
  try {
    // Parse the IP range (format: start-end)
    const [rangeStart, rangeEnd] = subnetCidr.split('-');
    const ipNum = ipToNumber(ip);
    const startNum = ipToNumber(rangeStart);
    const endNum = ipToNumber(rangeEnd);
    
    // Check if IP is within the range
    if (ipNum >= startNum && ipNum <= endNum) {
      return parseInt(subnetId, 10);
    }
    
    // If no match found and this is the default VLAN (1), return it as fallback
    if (subnetId === '1') {
      console.log(`[Subnet Validation] IP ${ip} not in range ${subnetCidr}, but using default VLAN 1`);
      return 1;
    }
    
    return null;
  } catch (error) {
    console.error('[Subnet Validation] Error:', error);
    return null;
  }
}

