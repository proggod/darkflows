import { NextResponse, NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { readConfig } from '@/lib/config';
import { syncAllSystems } from '@/lib/sync';
import { requireAuth } from '../../lib/auth';
import mysql from 'mysql2/promise';

// At the top of the file, after imports
process.stdout.write('=== Reservations API module loaded ===\n');

const execAsync = promisify(exec);
const DNS_MANAGER_SCRIPT = '/usr/local/darkflows/bin/unbound-dns-manager.py';

const getDbConnection = async () => {
  try {
    const config = await readConfig();
    const dbConfig = config.Dhcp4['lease-database'];
    
    return mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name
    });
  } catch {
    console.error('Error connecting to database');
    throw new Error('Failed to connect to database');
  }
};

async function syncDNSEntry(ip: string, hostname: string, shouldDelete = false) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] DNS Sync:`;

  try {
    const cmd = shouldDelete 
      ? `python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`
      : `python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname}`;
    
    process.stdout.write(`${prefix} Executing command: ${cmd}\n`);
    
    const { stdout, stderr } = shouldDelete
      ? await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`)
      : await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${ip} ${hostname}`);

    if (stdout) process.stdout.write(`${prefix} Output: ${stdout}\n`);
    if (stderr) process.stderr.write(`${prefix} Error: ${stderr}\n`);
    
    process.stdout.write(`${prefix} Command executed successfully\n`);
  } catch (error) {
    process.stderr.write(`${prefix} Failed: ${error}\n`);
  }
}

export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  let connection;
  try {
    connection = await getDbConnection();
    
    // Query the hosts table
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
      SELECT 
        INET_NTOA(ipv4_address) as 'ip-address',
        LOWER(HEX(dhcp_identifier)) as 'hw-address-hex',
        hostname
      FROM hosts
      WHERE dhcp_identifier_type = 1
    `);
    
    // Format MAC addresses with colons
    const reservations = rows.map(row => ({
      'ip-address': row['ip-address'],
      'hw-address': (row['hw-address-hex'].match(/.{1,2}/g) || []).join(':').toLowerCase(),
      hostname: row.hostname || ''
    }));
    
    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error reading reservations from database:', error);
    return NextResponse.json({ error: 'Failed to read reservations' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  let connection;
  try {
    const reservation = await request.json();
    
    // Validate the IP is in a valid subnet
    const subnetId = await getSubnetIdForIp(reservation['ip-address']);
    if (subnetId === null) {
      return NextResponse.json({ error: 'IP address is not in any configured subnet' }, { status: 400 });
    }
    
    // Convert MAC to binary format for database
    const macHex = reservation['hw-address'].replace(/:/g, '');
    const ipNumber = ipToNumber(reservation['ip-address']);
    
    connection = await getDbConnection();
    
    // Check if reservation already exists
    const [existing] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = 1',
      [macHex]
    );
    
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A reservation with this MAC address already exists' }, { status: 409 });
    }
    
    // Insert the new reservation
    await connection.execute(
      'INSERT INTO hosts (dhcp_identifier, dhcp_identifier_type, dhcp4_subnet_id, ipv4_address, hostname) VALUES (UNHEX(?), 1, ?, ?, ?)',
      [macHex, subnetId, ipNumber, reservation.hostname || null]
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
    if (connection) await connection.end();
  }
}

export async function DELETE(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

  let connection;
  try {
    const { ip, mac } = await request.json();
    
    // Convert MAC to binary format for database
    const macHex = mac.replace(/:/g, '');
    const ipNumber = ipToNumber(ip);
    
    connection = await getDbConnection();
    
    // Get hostname before deleting for DNS cleanup
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT hostname FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = 1 AND ipv4_address = ?',
      [macHex, ipNumber]
    );
    
    const hostname = rows[0]?.hostname;
    
    // Remove DNS entry if hostname exists
    if (hostname) {
      await syncDNSEntry(ip, hostname, true);
    }
    
    // Delete the reservation
    await connection.execute(
      'DELETE FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = 1 AND ipv4_address = ?',
      [macHex, ipNumber]
    );
    
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) return authResponse;

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
    
    // Get existing reservation
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT hostname FROM hosts WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = 1',
      [macHex]
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
      'UPDATE hosts SET ipv4_address = ?, hostname = ?, dhcp4_subnet_id = ? WHERE dhcp_identifier = UNHEX(?) AND dhcp_identifier_type = 1',
      [newIpNumber, reservation.hostname || null, subnetId, macHex]
    );
    
    await syncAllSystems();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

// Helper function to convert IP to number
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
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