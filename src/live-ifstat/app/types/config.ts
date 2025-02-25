export interface LeaseDatabaseConfig {
  user: string;
  password: string;
  name: string;
}

export interface Dhcp4Config {
  'lease-database': LeaseDatabaseConfig;
  subnet4: Array<{
    reservations: KeaReservation[];
    id?: number;
    subnet?: string;
  }>;
}

export interface Config {
  Dhcp4: Dhcp4Config;
} 