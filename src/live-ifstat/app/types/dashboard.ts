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
      'piholeLists',
      'blockClients'
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