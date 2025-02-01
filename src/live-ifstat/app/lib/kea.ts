import { promises as fs } from 'fs';
import mysql from 'mysql2/promise';
import { getManufacturer } from '@/lib/mac-lookup';

const KEA_CONFIG_PATH = '/etc/kea/kea-dhcp4.conf';

interface KeaConfig {
  Dhcp4: {
    'lease-database': {
      type: string;
      name: string;
      user: string;
      password: string;
    };
    subnet4: [{
      reservations: Array<{
        'ip-address': string;
        'hw-address': string;
        hostname?: string;
      }>;
    }];
  };
}

export async function getKeaHostnames(): Promise<Map<string, { name: string; mac: string; isReserved: boolean }>> {
  const hostnameMap = new Map();

  try {
    // Read config file for reservations
    const configContent = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
    const config: KeaConfig = JSON.parse(configContent);
    
    // Add reservations to the map
    const reservations = config.Dhcp4.subnet4[0]?.reservations || [];
    for (const reservation of reservations) {
      const mac = reservation['hw-address'].toLowerCase();
      const manufacturer = await getManufacturer(mac);
      console.log(`Reservation MAC ${mac} -> Manufacturer: ${manufacturer}`);
      
      hostnameMap.set(reservation['ip-address'], {
        name: reservation.hostname || manufacturer || reservation['ip-address'],
        mac: mac,
        isReserved: true
      });
    }

    // Connect to MySQL database for current leases
    const connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: config.Dhcp4['lease-database'].user,
      password: config.Dhcp4['lease-database'].password,
      database: config.Dhcp4['lease-database'].name
    });

    try {
      // Query active leases
      const [leases] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT 
          INET_NTOA(address) as ip_address,
          HEX(hwaddr) as hwaddr,
          hostname
        FROM lease4
        WHERE state = 0
          AND (expire > NOW() OR expire IS NULL)
      `);

      // Add leases to the map (don't overwrite reservations)
      for (const lease of leases) {
        const ip = lease.ip_address;
        if (!hostnameMap.has(ip)) {
          const formattedMac = lease.hwaddr
            ? lease.hwaddr.match(/../g)?.join(':').toLowerCase()
            : 'N/A';
          
          const manufacturer = formattedMac !== 'N/A' ? await getManufacturer(formattedMac) : null;
          console.log(`Lease MAC ${formattedMac} -> Manufacturer: ${manufacturer}`);
          
          hostnameMap.set(ip, {
            name: lease.hostname || manufacturer || ip,
            mac: formattedMac,
            isReserved: false
          });
        }
      }
    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Error getting Kea hostnames:', error);
  }

  // Log the final map
  console.log('Final hostname map:');
  hostnameMap.forEach((value, key) => {
    console.log(`${key} -> ${JSON.stringify(value)}`);
  });

  return hostnameMap;
} 