export interface NetworkDevice {
  name: string
  type?: 'primary' | 'secondary' | 'internal'
  label?: string
  egressBandwidth?: string
  ingressBandwidth?: string
} 