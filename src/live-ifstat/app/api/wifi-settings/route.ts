import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);
const HOSTAPD_CONFIG = '/etc/hostapd/hostapd.conf';

interface WifiSettings {
  interface: string;
  channel: number;
  txPower: number;
  supportedChannels: number[];
  maxTxPower: number;
  bands: {
    band: string;
    capabilities: string[];
    frequencies: Array<{
      frequency: number;
      channel: number;
      power: number;
    }>;
  }[];
  selectedBand?: string;
}

async function readHostapdConfig(): Promise<Partial<WifiSettings>> {
  try {
    const content = await fs.readFile(HOSTAPD_CONFIG, 'utf-8');
    const settings: Partial<WifiSettings> = {};
    
    const lines = content.split('\n');
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (!key || !value) continue;
      
      switch (key.trim()) {
        case 'interface':
          settings.interface = value.trim();
          break;
        case 'channel':
          settings.channel = parseInt(value.trim());
          break;
        case 'hw_mode':
          // hw_mode a = 5GHz, g = 2.4GHz
          settings.selectedBand = value.trim() === 'a' ? '5GHz' : '2.4GHz';
          break;
      }
    }
    
    return settings;
  } catch (error) {
    console.error('Error reading hostapd config:', error);
    return {};
  }
}

async function parseIwList(output: string, interface_name: string): Promise<WifiSettings> {
  const settings: WifiSettings = {
    interface: interface_name,
    channel: 1,
    txPower: 20,
    supportedChannels: [],
    maxTxPower: 20,
    bands: []
  };

  // Parse bands information
  const bandSections = output.match(/Band \d+:\s+((?:.|\n)+?)(?=(?:Band|$))/g);
  if (bandSections) {
    settings.bands = bandSections.map(section => {
      const band: WifiSettings['bands'][0] = {
        band: section.match(/Band (\d+):/)?.[1] === '1' ? '2.4GHz' : '5GHz',
        capabilities: [],
        frequencies: []
      };

      // Parse capabilities
      const capsMatch = section.match(/Capabilities: [^\n]+/);
      if (capsMatch) {
        band.capabilities = capsMatch[0]
          .replace('Capabilities:', '')
          .trim()
          .split('\n')[0]
          .split(' ')
          .filter(Boolean);
      }

      // Parse frequencies
      const freqSection = section.match(/Frequencies:\s+((?:\s+\* [^\n]+\n)+)/);
      if (freqSection) {
        band.frequencies = freqSection[1]
          .trim()
          .split('\n')
          .map(line => {
            const freqMatch = line.match(/\* (\d+) MHz \[(\d+)\] \((\d+\.\d+) dBm\)/);
            if (freqMatch) {
              return {
                frequency: parseInt(freqMatch[1]),
                channel: parseInt(freqMatch[2]),
                power: parseFloat(freqMatch[3])
              };
            }
            return null;
          })
          .filter((f): f is NonNullable<typeof f> => f !== null);

        // Update supported channels and max power
        band.frequencies.forEach(freq => {
          if (!settings.supportedChannels.includes(freq.channel)) {
            settings.supportedChannels.push(freq.channel);
          }
          if (freq.power > settings.maxTxPower) {
            settings.maxTxPower = freq.power;
          }
        });
      }

      return band;
    });
  }

  // Get current settings
  try {
    const { stdout: iwInfo } = await execAsync(`iw dev ${interface_name} info`);
    
    // Parse TX power
    const txPowerMatch = iwInfo.match(/txpower (\d+)/);
    if (txPowerMatch) {
      settings.txPower = parseInt(txPowerMatch[1]);
    }
  } catch (error) {
    console.error(`Error getting current settings for ${interface_name}:`, error);
  }

  return settings;
}

export async function GET() {
  try {
    // Check if hostapd.conf exists
    try {
      await fs.access(HOSTAPD_CONFIG);
    } catch {
      // File doesn't exist or not accessible
      return NextResponse.json(
        { error: 'WIFI_NOT_ENABLED' },
        { status: 404 }
      );
    }

    // First read hostapd config to get the interface name
    const hostapdSettings = await readHostapdConfig();
    
    if (!hostapdSettings.interface) {
      return NextResponse.json(
        { error: 'No interface configured in hostapd.conf' },
        { status: 500 }
      );
    }

    // Then read iw list output using the correct interface
    const { stdout } = await execAsync('iw list');
    const iwSettings = await parseIwList(stdout, hostapdSettings.interface);
    
    // Merge settings, preferring hostapd values
    const settings = {
      ...iwSettings,
      ...hostapdSettings
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting WiFi settings:', error);
    return NextResponse.json(
      { error: 'Failed to get WiFi settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings: WifiSettings = await request.json();

    // Read current hostapd config
    const currentConfig = await fs.readFile(HOSTAPD_CONFIG, 'utf-8');
    const lines = currentConfig.split('\n');
    
    // Update values
    const newLines = lines.map(line => {
      const [key] = line.split('=');
      if (!key) return line;
      
      switch (key.trim()) {
        case 'interface':
          return `interface=${settings.interface}`;
        case 'channel':
          return `channel=${settings.channel}`;
        case 'hw_mode':
          // Convert band selection to hw_mode
          return `hw_mode=${settings.selectedBand === '5GHz' ? 'a' : 'g'}`;
        default:
          return line;
      }
    });

    // Write updated config
    await fs.writeFile(HOSTAPD_CONFIG, newLines.join('\n'));

    // Set TX power using iw
    await execAsync(`iw dev ${settings.interface} set txpower fixed ${settings.txPower * 100}`);

    // Restart hostapd
    await execAsync('systemctl restart hostapd');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving WiFi settings:', error);
    return NextResponse.json(
      { error: 'Failed to save WiFi settings' },
      { status: 500 }
    );
  }
} 