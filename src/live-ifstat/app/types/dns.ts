export interface DnsClient {
  ip: string;
  lastSeen: number;
  name: string;
  mac: string;
  isReserved: boolean;
  status: 'reserved' | 'dynamic';
} 