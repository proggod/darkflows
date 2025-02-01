// import { Database } from 'sqlite3';
// import { open } from 'sqlite';

export async function getPiholeHostnames(): Promise<Map<string, string>> {
  // We're not using Pi-hole for hostnames - they come from DHCP
  return new Map();
} 