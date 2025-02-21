import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NetworkInterfaceConfig } from '@/types/dashboard';

const execAsync = promisify(exec);

interface IpAddressInfo {
  family: string;
  local: string;
  prefixlen: number;
}

interface NetworkInterface {
  ifname: string;
  addr_info?: IpAddressInfo[];
}

export async function GET() {
  try {
    // Get all IP addresses and their interfaces
    const { stdout: ipOutput } = await execAsync('ip -j addr show');
    const interfaces: NetworkInterface[] = JSON.parse(ipOutput);

    console.log('Raw interfaces:', interfaces.map(iface => ({
      name: iface.ifname,
      addresses: iface.addr_info?.map(addr => `${addr.local} (${addr.family})`)
    })));

    const networkInterfaces = interfaces
      .filter((iface) => 
        iface.ifname !== 'lo' && 
        !iface.ifname.startsWith('ifb') &&
        !iface.ifname.includes('@') &&
        iface.addr_info?.some(addr => addr.family === 'inet')
      )
      .map((iface): NetworkInterfaceConfig => {
        const ipv4Addr = iface.addr_info!.find(addr => addr.family === 'inet')!;
        console.log(`Processing interface ${iface.ifname}:`, {
          ipv4: ipv4Addr.local,
          prefix: ipv4Addr.prefixlen
        });

        const [ip] = ipv4Addr.local.split('/');
        const { start, end } = calculateNetworkRange(ip, ipv4Addr.prefixlen);

        return {
          name: iface.ifname,
          ipRange: { start, end }
        };
      });

    console.log('Processed interfaces:', networkInterfaces);
    return NextResponse.json(networkInterfaces);
  } catch (error) {
    console.error('Error getting network interfaces:', error);
    return NextResponse.json({ error: 'Failed to get network interfaces' }, { status: 500 });
  }
}

function calculateNetworkRange(ip: string, prefixLength: number) {
  // Convert IP to binary
  const ipBinary = ip.split('.')
    .map(octet => parseInt(octet))
    .reduce((acc, octet) => (acc << 8) + octet);

  // Calculate network and broadcast addresses
  const mask = ~((1 << (32 - prefixLength)) - 1);
  const networkAddr = ipBinary & mask;
  const broadcastAddr = networkAddr | ~mask;

  // Convert back to dotted decimal
  const start = [
    (networkAddr >> 24) & 255,
    (networkAddr >> 16) & 255,
    (networkAddr >> 8) & 255,
    networkAddr & 255
  ].join('.');

  const end = [
    (broadcastAddr >> 24) & 255,
    (broadcastAddr >> 16) & 255,
    (broadcastAddr >> 8) & 255,
    broadcastAddr & 255
  ].join('.');

  return { start, end };
} 