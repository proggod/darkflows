import { promises as fs } from 'fs';
import mysql from 'mysql2/promise';
import { getMacVendor } from '@/api/helpers/mac-vendor';

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

interface HostInfo {
  name: string;
  mac?: string;
  source: 'reservation' | 'lease' | 'vendor' | 'mac';
  isReserved: boolean;
}

export async function lookupHostname(ip: string): Promise<HostInfo> {
  console.log(`\n=== Looking up hostname for IP: ${ip} ===`);
  
  try {
    // 1. First try to get MAC from Kea leases (since this is most current)
    const configContent = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
    const config: KeaConfig = JSON.parse(configContent);
    
    const connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: config.Dhcp4['lease-database'].user,
      password: config.Dhcp4['lease-database'].password,
      database: config.Dhcp4['lease-database'].name
    });

    try {
      // Get both active and expired leases to ensure we find the MAC
      const [leases] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT HEX(hwaddr) as hwaddr, hostname FROM lease4 WHERE INET_NTOA(address) = ?',
        [ip]
      );

      if (leases.length > 0) {
        const lease = leases[0];
        const mac = lease.hwaddr.match(/../g)?.join(':').toLowerCase();
        let hostname = lease.hostname || undefined;

        // 2. Check reservations for potential hostname override
        const reservations = config.Dhcp4.subnet4[0]?.reservations || [];
        const reservation = reservations.find(r => r['ip-address'] === ip);
        if (reservation) {
          hostname = reservation.hostname || hostname;
        }

        // 3. Get vendor info if no hostname
        if (!hostname) {
          const vendor = await getMacVendor(mac);
          console.log('MAC lookup result:', { mac, vendor, hostname });

          return {
            name: vendor !== mac ? vendor : mac,
            mac,
            source: vendor !== mac ? 'vendor' : 'mac',
            isReserved: !!reservation
          };
        }

        return {
          name: hostname,
          mac,
          source: 'lease',
          isReserved: !!reservation
        };
      }

      throw new Error(`No lease found for IP ${ip}`);
    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Error in hostname lookup:', error);
    throw error; // Let the caller handle the error
  }
}

// New function to look up multiple hostnames at once
export async function lookupHostnames(ips: string[]): Promise<Map<string, HostInfo>> {
  const results = new Map<string, HostInfo>();
  
  // Return empty map if no IPs to look up
  if (!ips || ips.length === 0) {
    return results;
  }
  
  try {
    const configContent = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
    const config: KeaConfig = JSON.parse(configContent);
    
    const connection = await mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: config.Dhcp4['lease-database'].user,
      password: config.Dhcp4['lease-database'].password,
      database: config.Dhcp4['lease-database'].name
    });

    try {
      // Get lease data for IPs we're looking for
      const placeholders = ips.map(() => '?').join(',');
      const query = `
        SELECT 
          INET_NTOA(address) as ip, 
          HEX(hwaddr) as hwaddr, 
          hostname 
        FROM lease4 
        WHERE INET_NTOA(address) IN (${placeholders})
      `;

      const [leases] = await connection.execute<mysql.RowDataPacket[]>(query, ips);
      
      // Get all reservations
      const reservations = config.Dhcp4.subnet4[0]?.reservations || [];

      for (const lease of leases) {
        const ip = lease.ip;
        const mac = lease.hwaddr.match(/../g)?.join(':').toLowerCase();
        let hostname = lease.hostname || undefined;

        // Check if this IP has a reservation
        const reservation = reservations.find(r => r['ip-address'] === ip);
        if (reservation) {
          hostname = reservation.hostname || hostname;
        }

        if (!hostname && mac) {
          const vendor = await getMacVendor(mac);
          results.set(ip, {
            name: vendor !== mac ? vendor : mac,
            mac,
            source: vendor !== mac ? 'vendor' : 'mac',
            isReserved: !!reservation
          });
          continue;
        }

        if (hostname) {
          results.set(ip, {
            name: hostname,
            mac,
            source: 'lease',
            isReserved: !!reservation
          });
        } else if (mac) {
          // If we have a MAC but no hostname, still add it
          results.set(ip, {
            name: ip,
            mac,
            source: 'lease',
            isReserved: !!reservation
          });
        }
      }

      // For any IPs that are not in results yet, use default values
      for (const ip of ips) {
        if (!results.has(ip)) {
          // Try to find the IP in reservations
          const reservation = reservations.find(r => r['ip-address'] === ip);
          if (reservation) {
            const mac = reservation['hw-address'].toLowerCase();
            results.set(ip, {
              name: reservation.hostname || ip,
              mac,
              source: 'reservation',
              isReserved: true
            });
          } else {
            // No lease or reservation found
            results.set(ip, {
              name: ip,
              mac: 'N/A',
              source: 'mac',
              isReserved: false
            });
          }
        }
      }
    } finally {
      await connection.end();
    }

    return results;
  } catch (error) {
    console.error('Error in hostname lookups:', error);
    throw error;
  }
} 