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

export async function getMacVendor(macAddress: string): Promise<string | null> {
  let connection;
  try {
    const keaConfig = await getKeaConfig();
    const dbConfig = keaConfig.Dhcp4['lease-database'];

    connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'darkflows'
    });

    const macPrefix = macAddress.toLowerCase().replace(/:/g, '').slice(0, 6);
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT vendor FROM mac_vendor_lookup WHERE mac_prefix = ?',
      [macPrefix]
    );

    const vendor = (rows as { vendor: string }[])[0]?.vendor;
    return vendor || macAddress;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return null;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}