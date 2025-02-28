import { NextResponse, NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { readConfig } from '@/lib/config';
import { syncAllSystems } from '@/lib/sync';
import { requireAuth } from '../../lib/auth';
import mysql from 'mysql2/promise';

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

async function syncDNSEntry(ip: string, hostname: string, shouldDelete = false) {
  try {
    if (shouldDelete) {
      await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`);
    } else {
      await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname}`);
    }
  } catch (error) {
    console.error(`DNS Sync Error: ${error}`);
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
    
    // Query the hosts table with the correct identifier type
    const query = `
      SELECT 
        INET_NTOA(ipv4_address) as 'ip-address',
        LOWER(HEX(dhcp_identifier)) as 'hw-address-hex',
        hostname
      FROM hosts
      WHERE dhcp_identifier_type = ?
    `;
    
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(query, [macIdentifierType]);
    
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
    console.error('Error reading reservations from database:', error);
    return NextResponse.json({ 
      error: 'Failed to read reservations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
    
    // Validate the IP is in a valid subnet
    const subnetId = await getSubnetIdForIp(reservation['ip-address']);
    if (subnetId === null) {
      return NextResponse.json({ error: 'IP address is not in any configured subnet' }, { status: 400 });
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
    
    // Insert the new reservation
    await connection.execute(
      'INSERT INTO hosts (dhcp_identifier, dhcp_identifier_type, dhcp4_subnet_id, ipv4_address, hostname) VALUES (UNHEX(?), ?, ?, ?, ?)',
      [macHex, macIdentifierType, subnetId, ipNumber, reservation.hostname || null]
    );
    
    // Add DNS entry if hostname is provided
    if (reservation.hostname) {
      await syncDNSEntry(reservation['ip-address'], reservation.hostname);
    }
    
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function DELETE(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) {
    console.error('DELETE reservation - Authentication failed');
    return authResponse;
  }

  let connection;
  try {
    const { ip, mac } = await request.json();
    console.log('DELETE reservation - Request received:', { ip, mac });
    
    // Convert MAC to binary format for database
    const macHex = mac.replace(/:/g, '');
    const ipNumber = ipToNumber(ip);
    console.log('DELETE reservation - Converted values:', { macHex, ipNumber });
    
    connection = await getDbConnection();
    console.log('DELETE reservation - Database connection established');
    
    // Get correct identifier type for MAC addresses
    let macIdentifierType = 1; // Default value as fallback
    try {
      console.log('DELETE reservation - Fetching MAC identifier type');
      const [hwAddressType] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT type FROM host_identifier_type WHERE name = 'hw-address' OR name = 'hw_address' LIMIT 1"
      );
      
      if (hwAddressType.length > 0) {
        macIdentifierType = hwAddressType[0].type;
      }
      console.log('DELETE reservation - MAC identifier type:', macIdentifierType);
    } catch (err) {
      console.error('DELETE reservation - Error fetching MAC identifier type:', err);
      // Use default macIdentifierType if query fails
    }
    
    // DEBUG: Find all existing reservations
    try {
      console.log('DELETE reservation - DEBUG: Fetching all existing reservations');
      const [allReservations] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT INET_NTOA(ipv4_address) as ip, LOWER(HEX(dhcp_identifier)) as mac, dhcp_identifier_type FROM hosts'
      );
      console.log('DELETE reservation - DEBUG: All reservations:', JSON.stringify(allReservations, null, 2));
      
      // Try a query with just the MAC
      const [macOnlyRows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT INET_NTOA(ipv4_address) as ip, LOWER(HEX(dhcp_identifier)) as mac, dhcp_identifier_type FROM hosts WHERE dhcp_identifier = UNHEX(?)',
        [macHex]
      );
      console.log('DELETE reservation - DEBUG: Reservations matching MAC only:', JSON.stringify(macOnlyRows, null, 2));
    } catch (err) {
      console.error('DELETE reservation - DEBUG: Error fetching all reservations:', err);
    }
    
    // Get hostname before deleting for DNS cleanup
    console.log('DELETE reservation - Fetching existing reservation');
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT hostname FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ? AND ipv4_address = ?',
      [macHex, macIdentifierType, ipNumber]
    );
    
    // Try alternative query using INET_ATON for IP
    console.log('DELETE reservation - Trying alternative query with INET_ATON');
    const [rowsAlt] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT hostname FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ? AND ipv4_address = INET_ATON(?)',
      [macHex, macIdentifierType, ip]
    );
    
    console.log('DELETE reservation - Alternative query result:', {
      rowsAltLength: rowsAlt.length,
      rowsAlt: JSON.stringify(rowsAlt)
    });
    
    console.log('DELETE reservation - Existing reservation rows:', rows.length);
    const hostname = rows[0]?.hostname || rowsAlt[0]?.hostname;
    console.log('DELETE reservation - Hostname from existing reservation:', hostname);
    
    // Remove DNS entry if hostname exists
    if (hostname) {
      console.log('DELETE reservation - Removing DNS entry for hostname:', hostname);
      await syncDNSEntry(ip, hostname, true);
    }
    
    // Delete the reservation
    console.log('DELETE reservation - Executing DELETE query with params:', { macHex, macIdentifierType, ipNumber });
    let deleteResult: mysql.ResultSetHeader;
    
    // First try with original method
    const [deleteResultOriginal] = await connection.execute(
      'DELETE FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ? AND ipv4_address = ?',
      [macHex, macIdentifierType, ipNumber]
    ) as [mysql.ResultSetHeader, mysql.FieldPacket[]];
    
    console.log('DELETE reservation - Original delete result:', {
      affectedRows: deleteResultOriginal.affectedRows,
      warningStatus: deleteResultOriginal.warningStatus
    });
    
    // If original method didn't work, try with INET_ATON
    if (deleteResultOriginal.affectedRows === 0) {
      console.log('DELETE reservation - Trying alternative DELETE with INET_ATON');
      const [deleteResultAlt] = await connection.execute(
        'DELETE FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = ? AND ipv4_address = INET_ATON(?)',
        [macHex, macIdentifierType, ip]
      ) as [mysql.ResultSetHeader, mysql.FieldPacket[]];
      
      console.log('DELETE reservation - Alternative delete result:', {
        affectedRows: deleteResultAlt.affectedRows,
        warningStatus: deleteResultAlt.warningStatus
      });
      
      deleteResult = deleteResultAlt;
    } else {
      deleteResult = deleteResultOriginal;
    }
    
    if (deleteResult.affectedRows === 0) {
      console.error('DELETE reservation - No rows were deleted, reservation might not exist');
      return NextResponse.json({ 
        error: 'Reservation not found or could not be deleted',
        details: { ip, mac, macHex, ipNumber, macIdentifierType }
      }, { status: 404 });
    }
    
    try {
      console.log('DELETE reservation - Syncing all systems');
      await syncAllSystems();
      console.log('DELETE reservation - Successfully completed');
    } catch (error) {
      console.error('DELETE reservation - Error in syncAllSystems (continuing anyway):', error);
      // We'll consider the operation successful even if syncAllSystems fails
      // since the database record was successfully deleted
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : null;
    console.error('DELETE reservation - Error deleting reservation:', { 
      error, 
      message: errorMessage,
      stack: errorStack 
    });
    
    return NextResponse.json({ 
      error: 'Failed to delete reservation',
      details: errorMessage
    }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log('DELETE reservation - Database connection closed');
      } catch (err) {
        console.error('DELETE reservation - Error closing database connection:', err);
      }
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
    const subnetId = await getSubnetIdForIp(reservation['ip-address']);
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
      await syncDNSEntry(originalIp, existingHostname, true);
      // Add new DNS entry
      const ipAddress = reservation['ip-address'] ?? '';
      await syncDNSEntry(ipAddress, reservation.hostname ?? existingHostname);
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

// Helper function to convert IP to number
function ipToNumber(ip: string): number {
  // First method - traditional bit shifting (can result in negative numbers due to 32-bit signed integers)
  const traditionalMethod = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
  
  // Alternative method using separate calculation
  const parts = ip.split('.');
  const unsignedValue = ((parseInt(parts[0], 10) * 16777216) + 
                         (parseInt(parts[1], 10) * 65536) + 
                         (parseInt(parts[2], 10) * 256) + 
                          parseInt(parts[3], 10)) >>> 0;  // Ensure unsigned 32-bit integer
  
  console.log(`IP conversion debug - ${ip}:`, {
    traditionalMethod,
    unsignedValue,
    hexTraditional: `0x${traditionalMethod.toString(16)}`,
    hexUnsigned: `0x${unsignedValue.toString(16)}`
  });
  
  // Return the unsigned value, which is the correct representation for IP addresses
  return unsignedValue;
}

// Helper function to determine subnet ID based on IP address
async function getSubnetIdForIp(ip: string | undefined): Promise<number | null> {
  if (!ip) return null;
  
  try {
    // Read vlans.json to get subnet information
    const vlansContent = await fs.readFile('/etc/darkflows/vlans.json', 'utf-8');
    const vlans = JSON.parse(vlansContent);
    
    // Get main subnet from Kea config
    const config = await readConfig();
    const mainSubnet = config.Dhcp4.subnet4[0];
    const mainSubnetId = mainSubnet.id ?? 1;
    const mainSubnetCidr = mainSubnet.subnet;

    // Check if IP is in main subnet
    if (mainSubnetCidr && isIpInSubnet(ip, mainSubnetCidr)) {
      return mainSubnetId;
    }
    
    // Check if IP is in any VLAN subnet
    for (const vlan of vlans) {
      if (vlan.dhcp && vlan.subnet && isIpInSubnet(ip, vlan.subnet)) {
        const subnetConfig = config.Dhcp4.subnet4.find(s => s.subnet === vlan.subnet);
        if (subnetConfig?.id) {
          return subnetConfig.id;
        }
      }
    }
    
    return null;
  } catch {
    return 1; // Default to main subnet if there's an error
  }
}

// Helper function to check if an IP is in a subnet
function isIpInSubnet(ip: string, cidr: string): boolean {
  try {
    const [subnet, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipNum = ipToNumber(ip);
    const subnetNum = ipToNumber(subnet);
    
    return (ipNum & mask) === (subnetNum & mask);
  } catch {
    return false;
  }
} 