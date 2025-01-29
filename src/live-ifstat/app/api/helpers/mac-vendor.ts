import mysql from 'mysql2/promise';
import { promises as fs } from 'fs';

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

export async function getMacVendor(macAddress: string): Promise<string> {
  let connection;
  try {
    // Get Kea database credentials
    const keaConfig = await getKeaConfig();
    const dbConfig = keaConfig.Dhcp4['lease-database'];

    // Create connection using Kea credentials but for darkflows database
    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: dbConfig.user,         // This will be 'kea' from your config
      password: dbConfig.password, // This will be 'IayqXKWcosPT' from your config
      database: 'darkflows'        // Using darkflows database instead of kea
    });

    // Get first 8 characters without colons (updated from 6 to 8 to match table schema)
    const macPrefix = macAddress.toLowerCase().replace(/:/g, '').slice(0, 8);

    // Debug log
    //console.log('Looking up MAC vendor:', {
    //  macAddress,
    //  prefix: macPrefix,
    //  originalPrefix: macAddress.slice(0, 8)
    //});

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT vendor FROM mac_vendor_lookup WHERE mac_prefix = ?',
      [macPrefix]
    );

    const vendor = (rows as { vendor: string }[])[0]?.vendor || 'Unknown';

    // Debug log
    //console.log('Vendor lookup result:', {
    //  macAddress,
    //  prefix: macPrefix,
    //  vendor,
    //  rowCount: rows.length
    //});

    return vendor;
  } catch (error) {
    console.error('Error looking up MAC vendor:', {
      macAddress,
      error: error instanceof Error ? error.message : error
    });
    return 'Unknown';
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}