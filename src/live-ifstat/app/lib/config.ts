import { promises as fs } from 'fs';
import { exec } from 'child_process';

const KEA_CONFIG_PATH = '/etc/kea/kea-dhcp4.conf';

interface KeaReservation {
  'ip-address': string;
  'hw-address': string;
  hostname?: string;
}

interface KeaConfig {
  Dhcp4: {
    subnet4: [{
      reservations: KeaReservation[];
    }];
  };
}

export async function readConfig(): Promise<KeaConfig> {
  try {
    const content = await fs.readFile(KEA_CONFIG_PATH, 'utf-8');
    // Remove any trailing commas before parsing
    const cleanContent = content
      .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas before } or ]
      .replace(/,(\s*})/g, '}')       // Remove trailing commas before }
      .replace(/,(\s*\])/g, ']');     // Remove trailing commas before ]
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error parsing Kea config:', error);
    throw error;
  }
}

export async function writeConfig(config: KeaConfig): Promise<void> {
  // Remove duplicates before writing
  const seen = new Set<string>();
  config.Dhcp4.subnet4[0].reservations = config.Dhcp4.subnet4[0].reservations.filter((r: KeaReservation) => {
    const key = `${r['ip-address']}-${r['hw-address'].toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await fs.writeFile(KEA_CONFIG_PATH, JSON.stringify(config, null, 2));
  try {
    await new Promise((resolve, reject) => {
      exec('systemctl restart kea-dhcp4-server', (error: Error | null) => {
        if (error) {
          console.warn('Could not restart Kea configuration:', error);
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.warn('Could not restart Kea configuration:', error);
  }
}

export type { KeaConfig, KeaReservation }; 