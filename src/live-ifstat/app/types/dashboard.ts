import { DEFAULT_ITEMS } from '@/constants/dashboard'

export type ComponentCategory = 
  | 'all'
  | 'system_status'
  | 'network_status'
  | 'system_configuration'
  | 'network_management'
  | 'external_information'
  | 'custom_1'
  | 'custom_2'
  | 'custom_3';

export interface CategoryDefinition {
  id: ComponentCategory;
  label: string;
  defaultComponents: string[];
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'all',
    label: 'All Components',
    defaultComponents: [] // Will include all components
  },
  {
    id: 'system_status',
    label: 'System Status',
    defaultComponents: [
      'systemMonitor',
      'processes',
      'bandwidth',
      'speedTest'
    ]
  },
  {
    id: 'network_status',
    label: 'Network Status',
    defaultComponents: [
      'interfaceStatus',
      'networkPrimary',
      'networkSecondary',
      'networkInternal',
      'pingPrimary',
      'pingSecondary'
    ]
  },
  {
    id: 'system_configuration',
    label: 'System Configuration',
    defaultComponents: [
      'systemSettings',
      'sshKeys',
      'connectionTuning',
      'portForwards',
      'routeToSecondary',
      'sambaShares'
    ]
  },
  {
    id: 'network_management',
    label: 'Network Management',
    defaultComponents: [
      'dnsClients',
      'dnsHosts',
      'reservations',
      'leases',
      'CustomDNSLists',
      'blockClients',
      'vlans'
    ]
  },
  {
    id: 'external_information',
    label: 'External Information',
    defaultComponents: [
      'weather',
      'clock'
    ]
  },
  {
    id: 'custom_1',
    label: 'Custom Layout 1',
    defaultComponents: DEFAULT_ITEMS  // Use all default items
  },
  {
    id: 'custom_2',
    label: 'Custom Layout 2',
    defaultComponents: DEFAULT_ITEMS
  },
  {
    id: 'custom_3',
    label: 'Custom Layout 3',
    defaultComponents: DEFAULT_ITEMS
  }
];

export interface NetworkCard {
  deviceName: string;
  label?: string; // Optional label from network config
}

export interface IPRange {
  start: string;
  end: string;
  available: number;
  used: number;
}

export interface DHCPConfig {
  enabled: boolean;
  leaseTime: number;
  dnsServers: string[];
  defaultGateway: string;
  reservations: {
    macAddress: string;
    ipAddress: string;
    hostname?: string;
  }[];
}

export interface CommunicationGroup {
  name: string;
  allowedGroups: string[];
}

export interface VLANConfig {
  id: number;
  name: string;
  networkCard: NetworkCard;
  subnet: string;
  gateway: string;
  ipRange: IPRange;
  egressBandwidth?: string;
  ingressBandwidth?: string;
  cakeParams?: string;
  dhcp: DHCPConfig;
  communicationGroup: CommunicationGroup;
  created: Date;
  modified: Date;
}

export interface NetworkDevice {
  name: string;
  type?: 'primary' | 'secondary' | 'internal';
  label?: string;
}

export interface NetworkInterfaceConfig {
  name: string;
  ipRange?: {
    start: string;
    end: string;
  };
}

export interface NetworkConfig {
  interfaces?: NetworkInterfaceConfig[];
} 