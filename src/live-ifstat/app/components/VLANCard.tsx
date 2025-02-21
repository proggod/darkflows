'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem } from '@mui/material'
import { VLANConfig, NetworkCard, NetworkDevice, NetworkConfig, NetworkInterfaceConfig } from '@/types/dashboard'

interface VLANDialogProps {
  open: boolean
  onClose: () => void
  onSave: (vlan: VLANConfig) => void
  vlan?: VLANConfig
  networkCards: NetworkCard[]
  vlans: VLANConfig[]
  networkConfig?: NetworkConfig
  networkSettings?: {
    gatewayIp: string;
    subnetMask: string;
    ipPools: Array<{ start: string; end: string; }>;
  }
}

function VLANDialog({ open, onClose, onSave, vlan, networkCards, vlans, networkConfig, networkSettings }: VLANDialogProps) {
  const [id, setId] = useState<number>(1)
  const [name, setName] = useState('')
  const [networkCard, setNetworkCard] = useState<NetworkCard>({ deviceName: '' })
  const [subnet, setSubnet] = useState('')
  const [gateway, setGateway] = useState('')
  const [ipRange, setIpRange] = useState({
    start: '',
    end: '',
    available: 0,
    used: 0
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [dhcpEnabled, setDhcpEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (vlan) {
      setId(vlan.id)
      setName(vlan.name)
      setNetworkCard(vlan.networkCard)
      setSubnet(vlan.subnet)
      setGateway(vlan.gateway)
      setIpRange(vlan.ipRange)
    } else {
      setId(1)
      setName('')
      setNetworkCard({ deviceName: '' })
      setSubnet('')
      setGateway('')
      setIpRange({
        start: '',
        end: '',
        available: 0,
        used: 0
      })
    }
  }, [vlan])

  // Validation functions
  const isValidIp = (ip: string): boolean => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ip)) return false
    return ip.split('.').every(num => parseInt(num) >= 0 && parseInt(num) <= 255)
  }

  const isValidSubnet = (subnet: string): boolean => {
    const [ip, mask] = subnet.split('/')
    if (!ip || !mask) return false
    if (!isValidIp(ip)) return false
    const maskNum = parseInt(mask)
    return maskNum >= 0 && maskNum <= 32
  }

  const isIpInSubnet = (ip: string, subnet: string): boolean => {
    try {
      const [networkIp, mask] = subnet.split('/')
      const maskBits = parseInt(mask)
      const networkBinary = networkIp.split('.')
        .map(num => parseInt(num))
        .map(num => num.toString(2).padStart(8, '0'))
        .join('')
      const ipBinary = ip.split('.')
        .map(num => parseInt(num))
        .map(num => num.toString(2).padStart(8, '0'))
        .join('')
      
      return networkBinary.slice(0, maskBits) === ipBinary.slice(0, maskBits)
    } catch {
      return false
    }
  }

  // Add this helper function to check if IP ranges overlap
  const doRangesOverlap = (range1Start: string, range1End: string, range2Start: string, range2End: string): boolean => {
    const ipToNum = (ip: string): number => {
      const parts = ip.split('.').map(Number)
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
    }
    
    const start1 = ipToNum(range1Start)
    const end1 = ipToNum(range1End)
    const start2 = ipToNum(range2Start)
    const end2 = ipToNum(range2End)
    
    return start1 <= end2 && start2 <= end1
  }

  // Add this helper function
  const isIpInUse = (ip: string, interfaces: NetworkInterfaceConfig[]): boolean => {
    const ipToNum = (ip: string): number => {
      const parts = ip.split('.').map(Number)
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
    }

    return interfaces.some(iface => {
      if (!iface.ipRange) return false
      const ipv4Addr = ipToNum(ip)
      const startAddr = ipToNum(iface.ipRange.start)
      const endAddr = ipToNum(iface.ipRange.end)
      return ipv4Addr >= startAddr && ipv4Addr <= endAddr
    })
  }

  // Add this helper function to calculate IP range from gateway and subnet
  const calculateIpRange = (gateway: string, subnet: string) => {
    const [networkIp, mask] = subnet.split('/')
    if (!networkIp || !mask) return null
    
    const maskNum = parseInt(mask)
    const ipParts = networkIp.split('.').map(num => parseInt(num))
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]
    
    const maskBits = 0xffffffff << (32 - maskNum)
    const networkNum = ipNum & maskBits
    const broadcastNum = networkNum | (~maskBits)
    
    // Convert to octets
    const networkOctets = [
      (networkNum >> 24) & 0xff,
      (networkNum >> 16) & 0xff,
      (networkNum >> 8) & 0xff,
      networkNum & 0xff
    ]
    
    const broadcastOctets = [
      (broadcastNum >> 24) & 0xff,
      (broadcastNum >> 16) & 0xff,
      (broadcastNum >> 8) & 0xff,
      broadcastNum & 0xff
    ]
    
    return {
      start: `${networkOctets[0]}.${networkOctets[1]}.${networkOctets[2]}.${networkOctets[3] + 2}`,
      end: `${broadcastOctets[0]}.${broadcastOctets[1]}.${broadcastOctets[2]}.${broadcastOctets[3] - 1}`,
      available: broadcastNum - networkNum - 2,
      used: 0
    }
  }

  // Update validateForm function
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {}
    
    console.group('VLAN Validation')
    console.log('Network Config:', {
      interfaces: networkConfig?.interfaces?.map(i => ({
        name: i.name,
        ipRange: i.ipRange
      }))
    })
    console.log('Network Settings:', {
      ipPools: networkSettings?.ipPools
    })
    console.log('New VLAN Config:', {
      interface: networkCard.deviceName,
      subnet,
      ipRange
    })

    // Validate VLAN ID
    if (id < 1 || id > 4094) {
      newErrors.id = 'VLAN ID must be between 1 and 4094'
    }

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    // Validate network interface
    if (!networkCard.deviceName) {
      newErrors.networkCard = 'Network interface is required'
    }

    // Validate subnet
    if (!isValidSubnet(subnet)) {
      newErrors.subnet = 'Invalid subnet format (e.g., 192.168.1.0/24)'
    }

    // Validate gateway
    if (!isValidIp(gateway)) {
      newErrors.gateway = 'Invalid gateway IP'
    } else if (!isIpInSubnet(gateway, subnet)) {
      newErrors.gateway = 'Gateway must be in the specified subnet'
    }

    // Validate IP range
    if (!isValidIp(ipRange.start)) {
      newErrors.ipRangeStart = 'Invalid start IP'
    } else if (!isIpInSubnet(ipRange.start, subnet)) {
      newErrors.ipRangeStart = 'Start IP must be in the specified subnet'
    } else if (ipRange.start === gateway) {
      newErrors.ipRangeStart = 'Start IP cannot be the gateway IP'
    }

    if (!isValidIp(ipRange.end)) {
      newErrors.ipRangeEnd = 'Invalid end IP'
    } else if (!isIpInSubnet(ipRange.end, subnet)) {
      newErrors.ipRangeEnd = 'End IP must be in the specified subnet'
    } else if (ipRange.end === gateway) {
      newErrors.ipRangeEnd = 'End IP cannot be the gateway IP'
    }

    // Validate IP range order
    if (isValidIp(ipRange.start) && isValidIp(ipRange.end)) {
      const start = ipRange.start.split('.').map(num => parseInt(num))
      const end = ipRange.end.split('.').map(num => parseInt(num))
      const startNum = (start[0] << 24) | (start[1] << 16) | (start[2] << 8) | start[3]
      const endNum = (end[0] << 24) | (end[1] << 16) | (end[2] << 8) | end[3]
      if (startNum >= endNum) {
        newErrors.ipRange = 'End IP must be greater than start IP'
      }
    }

    // Check for conflicts with existing VLANs
    const otherVlans = vlans?.filter(v => v.id !== id) || []
    for (const existingVlan of otherVlans) {
      if (doRangesOverlap(
        ipRange.start,
        ipRange.end,
        existingVlan.ipRange.start,
        existingVlan.ipRange.end
      )) {
        newErrors.ipRange = `IP range overlaps with VLAN ${existingVlan.id} (${existingVlan.name})`
        break
      }
    }

    // Check for conflicts with main network interfaces
    const mainNetworks = networkCards
      .filter(card => card.deviceName !== networkCard.deviceName)
      .map(card => {
        // Get network config for this interface
        const config = networkConfig?.interfaces?.find((i: NetworkInterfaceConfig) => i.name === card.deviceName)
        return config ? {
          start: config.ipRange?.start,
          end: config.ipRange?.end
        } : null
      })
      .filter(Boolean)

    for (const network of mainNetworks) {
      if (network?.start && network?.end && doRangesOverlap(
        ipRange.start,
        ipRange.end,
        network.start,
        network.end
      )) {
        newErrors.ipRange = `IP range overlaps with existing network interface`
        break
      }
    }

    // Check for conflicts with system interfaces
    if (networkConfig?.interfaces) {
      console.log('Checking interfaces:', networkConfig.interfaces);
      
      for (const iface of networkConfig.interfaces) {
        console.log(`\nChecking interface ${iface.name}:`, {
          interfaceRange: iface.ipRange,
          vlanRange: ipRange,
          isDocker: iface.name.startsWith('br-'),
          isDockerNetwork: iface.name.startsWith('docker'),
          isTailscale: iface.name === 'tailscale0'
        });

        // Skip docker and bridge interfaces
        if (iface.name.startsWith('br-') || 
            iface.name.startsWith('docker') || 
            iface.name === 'tailscale0') {
          console.log('Skipping virtual interface');
          continue;
        }

        if (iface.ipRange) {
          const hasConflict = doRangesOverlap(
            ipRange.start,
            ipRange.end,
            iface.ipRange.start,
            iface.ipRange.end
          );
          
          console.log('Range overlap check:', {
            vlanStart: ipRange.start,
            vlanEnd: ipRange.end,
            ifaceStart: iface.ipRange.start,
            ifaceEnd: iface.ipRange.end,
            hasConflict
          });

          if (hasConflict) {
            console.log('IP Conflict Found:', {
              interface: iface.name,
              ifaceRange: iface.ipRange,
              vlanRange: ipRange
            });
            newErrors.ipRange = `IP range conflicts with network interface ${iface.name} (${iface.ipRange.start}-${iface.ipRange.end})`;
            break;
          }
        }
      }
    }

    // Check for conflicts with system IP pools
    if (networkSettings?.ipPools) {
      for (const pool of networkSettings.ipPools) {
        if (doRangesOverlap(
          ipRange.start,
          ipRange.end,
          pool.start,
          pool.end
        )) {
          newErrors.ipRange = `IP range conflicts with system IP pool (${pool.start}-${pool.end})`
          break
        }
      }
    }

    // Check if gateway or range IPs are in use by any interface
    if (networkConfig?.interfaces) {
      if (isIpInUse(gateway, networkConfig.interfaces)) {
        newErrors.gateway = `Gateway IP is already in use by an interface`
      }
      if (isIpInUse(ipRange.start, networkConfig.interfaces)) {
        newErrors.ipRangeStart = `Start IP is already in use by an interface`
      }
      if (isIpInUse(ipRange.end, networkConfig.interfaces)) {
        newErrors.ipRangeEnd = `End IP is already in use by an interface`
      }
    }

    console.log('Validation Errors:', newErrors)
    console.groupEnd()

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const resetForm = () => {
    setId(1)
    setName('')
    setNetworkCard({ deviceName: '' })
    setSubnet('')
    setGateway('')
    setIpRange({
      start: '',
      end: '',
      available: 0,
      used: 0
    })
    setErrors({})
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    try {
      await onSave({
        id,
        name,
        networkCard,
        subnet,
        gateway,
        ipRange,
        dhcp: {
          enabled: dhcpEnabled,
          leaseTime: 86400,
          dnsServers: dhcpEnabled ? [gateway] : [],
          defaultGateway: dhcpEnabled ? gateway : '',
          reservations: []
        },
        communicationGroup: {
          name: 'default',
          allowedGroups: []
        },
        created: new Date(),
        modified: new Date()
      })
      
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  // Filter out ifb interfaces and prepare cards with labels
  const filteredCards = networkCards.filter(card => 
    !card.deviceName.startsWith('ifb')
  )

  // Update subnet handler to auto-fill
  const handleSubnetChange = (newSubnet: string) => {
    setSubnet(newSubnet)
    
    // Only proceed if we have a valid subnet format
    if (isValidSubnet(newSubnet)) {
      // Calculate default gateway and IP range
      const range = calculateIpRange(gateway, newSubnet)
      if (range) {
        setGateway(gateway) // Keep existing gateway if it's set
        setIpRange(range)
      }
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg'
      }}
    >
      <DialogTitle className="border-b border-gray-200 dark:border-gray-700 px-6 py-2">
        {vlan ? 'Edit VLAN' : 'Add VLAN'}
      </DialogTitle>
      <DialogContent className="!p-6">
        <div className="flex gap-8">
          {/* Left column */}
          <div className="space-y-2 w-[205px]">
            <div className="flex flex-col">
              <div className="flex items-center">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                  VLAN ID
                </label>
                <input
                  type="number"
                  value={id}
                  onChange={(e) => setId(parseInt(e.target.value))}
                  disabled={!!vlan}
                  placeholder="1-4094"
                  className="w-[120px] px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
              {errors.id && (
                <span className="text-[9px] text-red-500 mt-0.5">{errors.id}</span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VLAN Name"
                  className="w-[120px] px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
              {errors.name && (
                <span className="text-[9px] text-red-500 mt-0.5">{errors.name}</span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                  Network Interface
                </label>
                <Select
                  value={networkCard.deviceName}
                  onChange={(e) => {
                    const selectedCard = filteredCards.find(card => card.deviceName === e.target.value);
                    setNetworkCard(selectedCard || { deviceName: e.target.value });
                  }}
                  className="w-[120px] text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  sx={{
                    height: '24px',
                    '.MuiSelect-select': {
                      padding: '1px 6px',
                    },
                    '.MuiSelect-icon': {
                      color: 'currentColor',
                    },
                    '.MuiOutlinedInput-notchedOutline': {
                      border: 'none',
                    },
                    '&.Mui-focused': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none',
                      },
                    }
                  }}
                  MenuProps={{
                    PaperProps: {
                      className: 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
                      sx: {
                        '& .MuiMenuItem-root': {
                          fontSize: '10px',
                          padding: '4px 8px',
                          '&:hover': {
                            backgroundColor: '#f3f4f6',
                          },
                          '&.Mui-selected': {
                            backgroundColor: '#f3f4f6',
                            '&:hover': {
                              backgroundColor: '#e5e7eb',
                            },
                          },
                          '@media (prefers-color-scheme: dark)': {
                            '&:hover': {
                              backgroundColor: '#4b5563',
                            },
                            '&.Mui-selected': {
                              backgroundColor: '#4b5563',
                              '&:hover': {
                                backgroundColor: '#6b7280',
                              },
                            },
                          }
                        }
                      }
                    }
                  }}
                >
                  {filteredCards.map(card => (
                    <MenuItem 
                      key={card.deviceName} 
                      value={card.deviceName}
                      className="text-gray-900 dark:text-gray-100"
                    >
                      {card.label || card.deviceName}
                    </MenuItem>
                  ))}
                </Select>
              </div>
              {errors.networkCard && (
                <span className="text-[9px] text-red-500 mt-0.5">{errors.networkCard}</span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                  Subnet
                </label>
                <input
                  type="text"
                  value={subnet}
                  onChange={(e) => handleSubnetChange(e.target.value)}
                  placeholder="192.168.1.0/24"
                  className="flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
              {errors.subnet && (
                <span className="text-[9px] text-red-500 mt-0.5">{errors.subnet}</span>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-2 flex-1">
            <div className="flex flex-col">
              <div className="flex items-center">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                  Gateway
                </label>
                <input
                  type="text"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  placeholder="192.168.1.1"
                  className="flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
              {errors.gateway && (
                <span className="text-[9px] text-red-500 mt-0.5">{errors.gateway}</span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                  IP Range
                </label>
                <div className="flex-1 flex items-center space-x-1">
                  <input
                    type="text"
                    value={ipRange.start}
                    onChange={(e) => setIpRange({ ...ipRange, start: e.target.value })}
                    placeholder="Start IP"
                    className="flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="text-[10px] text-gray-500">-</span>
                  <input
                    type="text"
                    value={ipRange.end}
                    onChange={(e) => setIpRange({ ...ipRange, end: e.target.value })}
                    placeholder="End IP"
                    className="flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
              </div>
              {(errors.ipRangeStart || errors.ipRangeEnd || errors.ipRange) && (
                <span className="text-[9px] text-red-500 mt-0.5">
                  {errors.ipRangeStart || errors.ipRangeEnd || errors.ipRange}
                </span>
              )}
            </div>

            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                checked={dhcpEnabled}
                onChange={(e) => setDhcpEnabled(e.target.checked)}
                className="mr-2"
              />
              <label className="text-[10px] text-gray-700 dark:text-gray-300">
                Enable DHCP
              </label>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogActions className="p-6 border-t border-gray-800">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium 
                   hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 
                   focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="h-6 px-2 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium 
                   hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 
                   focus:ring-green-500 dark:focus:ring-green-400 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </DialogActions>
    </Dialog>
  )
}

export default function VLANCard() {
  const [vlans, setVlans] = useState<VLANConfig[]>([])
  const [networkCards, setNetworkCards] = useState<NetworkCard[]>([])
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>()
  const [networkSettings, setNetworkSettings] = useState<{
    gatewayIp: string;
    subnetMask: string;
    ipPools: Array<{ start: string; end: string; }>;
  }>()
  const [error, setError] = useState<string>('')
  const [showAddVlan, setShowAddVlan] = useState(false)
  const [editingVlan, setEditingVlan] = useState<VLANConfig | undefined>()

  const loadData = async () => {
    try {
      setError('')
      
      // Load network settings
      const networkConfigResponse = await fetch('/api/network-settings')
      if (!networkConfigResponse.ok) throw new Error('Failed to load network config')
      const networkConfigData = await networkConfigResponse.json()
      setNetworkSettings(networkConfigData)
      
      // Load network interfaces
      const interfacesResponse = await fetch('/api/network-interfaces')
      if (!interfacesResponse.ok) throw new Error('Failed to load network interfaces')
      const interfaces = await interfacesResponse.json()
      
      console.log('Raw network interfaces:', interfaces)
      
      // Filter out virtual interfaces
      const physicalInterfaces = interfaces.filter((iface: NetworkInterfaceConfig) => 
        !iface.name.startsWith('br-') && 
        !iface.name.startsWith('docker') && 
        !iface.name.startsWith('veth') &&
        !iface.name.startsWith('ifb') &&
        iface.name !== 'tailscale0' &&
        iface.name !== 'lo'
      )
      
      console.log('Physical interfaces:', physicalInterfaces)
      setNetworkConfig({ interfaces: physicalInterfaces })

      // Load VLANs
      const vlansResponse = await fetch('/api/vlans')
      if (!vlansResponse.ok) throw new Error('Failed to load VLANs')
      const vlansData = await vlansResponse.json()
      setVlans(vlansData)

      // Use devices API with labels
      const devicesResponse = await fetch('/api/devices')
      if (!devicesResponse.ok) throw new Error('Failed to load network cards')
      const { devices } = await devicesResponse.json() as { devices: NetworkDevice[] }
      
      // Convert devices to NetworkCard format with labels
      const cards: NetworkCard[] = devices
        .filter((device: NetworkDevice) => 
          device.name !== 'lo' && 
          !device.name.includes('@') &&
          !device.name.startsWith('ifb')
        )
        .map((device: NetworkDevice) => ({
          deviceName: device.name,
          label: device.label || device.name // Use label if available, fallback to name
        }))
      
      setNetworkCards(cards)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load data')
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSaveVlan = async (vlan: VLANConfig) => {
    try {
      setError('')
      const response = await fetch('/api/vlans' + (editingVlan ? `/${vlan.id}` : ''), {
        method: editingVlan ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vlan),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save VLAN')
      }

      setShowAddVlan(false)
      setEditingVlan(undefined)
      await loadData()
    } catch (error) {
      console.error('Error saving VLAN:', error)
      setError('Failed to save VLAN')
    }
  }

  const handleDeleteVlan = async (id: number) => {
    try {
      setError('')
      const response = await fetch(`/api/vlans/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete VLAN')
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting VLAN:', error)
      setError('Failed to delete VLAN')
    }
  }

  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="text-label mb-2">VLAN Configuration</h3>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowAddVlan(true)}
            className="btn btn-blue"
          >
            Add VLAN
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">ID</th>
                <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Interface</th>
                <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Subnet</th>
                <th className="px-2 py-1 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vlans.map((vlan, index) => (
                <tr 
                  key={vlan.id} 
                  className={`card-hover ${
                    index % 2 === 0 ? '' : 'card-alternate'
                  } ${index === vlans.length - 1 ? 'last-row' : ''}`}
                >
                  <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{vlan.id}</td>
                  <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{vlan.name}</td>
                  <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">
                    {vlan.networkCard.label || vlan.networkCard.deviceName}
                  </td>
                  <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{vlan.subnet}</td>
                  <td className="px-2 py-1 text-xs text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingVlan(vlan);
                        setShowAddVlan(true);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteVlan(vlan.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <VLANDialog
        open={showAddVlan}
        onClose={() => {
          setShowAddVlan(false)
          setEditingVlan(undefined)
        }}
        onSave={handleSaveVlan}
        vlan={editingVlan}
        networkCards={networkCards}
        vlans={vlans}
        networkConfig={networkConfig}
        networkSettings={networkSettings}
      />
    </div>
  )
} 