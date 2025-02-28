import { promisify } from 'util';
import { exec } from 'child_process';
import { readConfig } from './config';

const execAsync = promisify(exec);
const DNS_MANAGER_SCRIPT = '/usr/local/darkflows/bin/unbound-dns-manager.py';

export async function syncAllSystems() {
  try {
    const config = await readConfig();
    const reservations = config.Dhcp4.subnet4[0].reservations;
    
    // Get current DNS entries
    const { stdout } = await execAsync(`python3 ${DNS_MANAGER_SCRIPT} list`);
    const entries = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Handle malformed lines safely
        const parts = line.split(' -> ');
        if (parts.length < 2 || !parts[1]) {
          console.warn(`Skipping malformed DNS entry: ${line}`);
          return null;
        }
        const [ip, hostnames] = parts;
        return { ip, hostnames: hostnames.split(', ') };
      })
      .filter(entry => entry !== null) as { ip: string; hostnames: string[] }[];

    // Remove all DNS entries that don't match reservations
    for (const entry of entries) {
      const reservation = reservations.find(r => r['ip-address'] === entry.ip);
      if (!reservation || !reservation.hostname) {
        for (const hostname of entry.hostnames) {
          await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`);
        }
      } else if (entry.hostnames[0] !== reservation.hostname) {
        // Remove old hostname and add new one
        for (const hostname of entry.hostnames) {
          await execAsync(`python3 ${DNS_MANAGER_SCRIPT} remove ${hostname}`);
        }
        await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${entry.ip} ${reservation.hostname}`);
      }
    }

    // Add missing DNS entries from reservations
    for (const reservation of reservations) {
      if (reservation.hostname) {
        const hasEntry = entries.some(entry => 
          entry.ip === reservation['ip-address'] && 
          entry.hostnames.includes(reservation.hostname!)
        );
        if (!hasEntry) {
          await execAsync(`python3 ${DNS_MANAGER_SCRIPT} add ${reservation['ip-address']} ${reservation.hostname}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in syncAllSystems:', error instanceof Error ? error.message : 'Unknown error');
    // Don't rethrow the error to prevent breaking the calling function
  }
} 