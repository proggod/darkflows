import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to check if IP is internal
function isInternalIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.)/.test(ip);
}

// Helper function to extract domain from SOA record
function extractDomainFromSOA(digOutput: string): string | null {
  // Look for common patterns in the SOA record
  if (digOutput.includes('cloudflare.com')) {
    return 'Cloudflare Network';
  }
  if (digOutput.includes('google') || digOutput.includes('1e100.net')) {
    return 'Google Cloud';
  }
  if (digOutput.includes('amazonaws.com')) {
    return 'AWS Network';
  }
  if (digOutput.includes('azure')) {
    return 'Microsoft Azure';
  }
  if (digOutput.includes('apple.com')) {
    return 'Apple Network';
  }

  // Extract the SOA server name
  const soaMatch = digOutput.match(/SOA\s+([^\s]+)\s+([^\s]+)/);
  if (soaMatch) {
    const [, soaServer, soaEmail] = soaMatch;
    
    // Try to extract organization from either SOA server or email
    for (const field of [soaServer, soaEmail]) {
      const domainParts = field.toLowerCase().split('.');
      if (domainParts.length >= 2) {
        const domain = `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}`.replace(/\.$/, '');
        if (!domain.includes('in-addr.arpa') && !domain.includes('iana.org')) {
          return domain;
        }
      }
    }
  }

  return null;
}

// Helper function to perform reverse DNS lookup
async function getHostInfo(ip: string): Promise<string> {
  try {
    if (isInternalIP(ip)) {
      return 'Internal IP';
    }

    try {
      // Try reverse DNS lookup first
      const { stdout: ptrOutput } = await execAsync(`dig -x ${ip} | grep -v "^;"| grep PTR || true`);
      if (ptrOutput.trim()) {
        return ptrOutput.trim().replace(/\.$/, '');
      }
    } catch {}

    // If no PTR record or error, try to get domain owner from SOA record
    try {
      const { stdout: soaOutput } = await execAsync(`dig -x ${ip} | grep -v "^;" | grep SOA || true`);
      const domain = extractDomainFromSOA(soaOutput);
      if (domain) {
        return domain;
      }
    } catch {}

    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export async function GET(
  request: Request,
  { params }: { params: { ip: string } }
) {
  try {
    const paramsData = await Promise.resolve(params);
    
    if (!paramsData?.ip) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      );
    }

    const ip = decodeURIComponent(paramsData.ip);
    
    // Execute the bandwidth monitoring script
    const { stdout, stderr } = await execAsync(
      `python3 /usr/local/darkflows/bin/monitor_single_ip.py ${ip}`
    );

    if (stderr) {
      return NextResponse.json(
        { error: 'Error executing monitoring script' },
        { status: 500 }
      );
    }

    // Parse the JSON output
    const data = JSON.parse(stdout);
    
    // Get hostname for destination IP
    const destHostname = await getHostInfo(ip);
    data.hostname = destHostname;

    // If there are connections, get hostnames for source IPs
    if (data.connections) {
      for (const conn of data.connections) {
        const sourceIp = conn.source.split(':')[0];
        const sourceHostname = await getHostInfo(sourceIp);
        conn.source = `${conn.source} (${sourceHostname})`;
      }
    }
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bandwidth details' },
      { status: 500 }
    );
  }
} 