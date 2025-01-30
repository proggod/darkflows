'use client'

import { useState, useEffect } from 'react'
import SystemMonitor from '@/components/SystemMonitor'
import SpeedTestNew from '@/components/SpeedTestNew'
import PingStatsCard from '@/components/PingStatsCard'
import { DnsClientsCard } from '@/components/DnsClientsCard'
import NetworkStatsCard from '@/components/NetworkStatsCard'
import ConnectionTuningNew from '@/components/ConnectionTuningNew'
import InterfaceStatusCard from '@/components/InterfaceStatusCard'
import WeatherCard from '@/components/WeatherCard'
import SambaSharesCard from '@/components/SambaSharesCard'
import { useEditMode } from '@/contexts/EditModeContext'
import { useTheme } from '@/contexts/ThemeContext'
import { SystemSettingsCard } from '@/components/SystemSettingsCard'
import { BlockClientsCard } from '@/components/BlockClientsCard'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableItem } from '@/components/SortableItem'
import ReservationsCard from '@/components/ReservationsCard'
import LeasesCard from '@/components/LeasesCard'
import ServicesCard from '@/components/ServicesCard'
import RouteHostToSecondary from '@/components/RouteHostToSecondary'
import PortForwards from '@/components/PortForwards'
import DnsHosts from '@/components/DnsHosts'
import PiholeLists from '@/components/PiholeLists'
import BandwidthUsage from './components/BandwidthUsage'
import React from 'react'
import { useNetworkStats } from '@/hooks/useNetworkStats'
import SshKeysCard from '@/components/SshKeysCard'
import { usePingData } from '@/contexts/PingDataContext'
import Clock from '@/components/Clock'
import { ErrorBoundary } from '@/components/ErrorBoundary'

interface NetworkInterface {
  name: string
  speed?: string
  label?: string
  type?: 'primary' | 'secondary' | 'internal'
}

interface IfstatData {
  timestamp: string
  interface: string
  kbIn: number
  kbOut: number
}

const DEFAULT_ITEMS = [
  'systemMonitor',
  'interfaceStatus',
  'pingPrimary',
  'pingSecondary',
  'speedTest',
  'connectionTuning',
  'reservations',
  'leases',
  'weather',
  'processes',
  'sambaShares',
  'sshKeys',
  'dnsClients',
  'blockClients',
  'routeToSecondary',
  'portForwards',
  'dnsHosts',
  'piholeLists',
  'bandwidth',
  'systemSettings',
  'clock',
]

const CombinedDashboard = () => {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const { networkStats } = useNetworkStats()
  const { isEditMode } = useEditMode()
  const { isDarkMode } = useTheme()
  const { networkConfig, isLoading: isPingDataLoading } = usePingData()
  
  const [items, setItems] = useState<string[]>(DEFAULT_ITEMS)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())

  // Load saved state from localStorage
  useEffect(() => {
    const loadSavedState = () => {
      try {
        // Force reset if network config changes
        if (!networkConfig?.SECONDARY_INTERFACE) {
          localStorage.removeItem('betaDashboardOrder')
          localStorage.removeItem('betaDashboardHidden')
          setItems(DEFAULT_ITEMS.filter(item => item !== 'pingSecondary'))
          setHiddenItems(new Set())
          return
        }
        const savedOrder = localStorage.getItem('betaDashboardOrder')
        const savedHidden = localStorage.getItem('betaDashboardHidden')
        
        // Check if we have saved state and parse it
        const parsedOrder = savedOrder ? JSON.parse(savedOrder) : null
        const parsedHidden = savedHidden ? JSON.parse(savedHidden) : null
        
        // Verify all default components exist in saved order
        const hasAllComponents = DEFAULT_ITEMS.every(item => 
          parsedOrder ? parsedOrder.includes(item) : false
        )
        
        if (parsedOrder && hasAllComponents) {
          // Only use saved order if it has all required components
          setItems(parsedOrder)
          if (parsedHidden) {
            setHiddenItems(new Set(parsedHidden))
          }
        } else {
          // Reset to defaults if any components are missing
          // console.log('Missing components in dashboard - resetting layout')
          localStorage.removeItem('betaDashboardOrder')
          localStorage.removeItem('betaDashboardHidden')
          localStorage.removeItem('betaDashboardVersion')
          setItems(DEFAULT_ITEMS)
          setHiddenItems(new Set())
        }
      } catch {  // Remove unused 'e' parameter
        // Silent fail for localStorage issues
      }
    }

    loadSavedState()
  }, [networkConfig?.SECONDARY_INTERFACE])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('betaDashboardOrder', JSON.stringify(items))
      localStorage.setItem('betaDashboardHidden', JSON.stringify(Array.from(hiddenItems)))
    } catch (e) {
      console.error('Failed to save dashboard state:', e)
    }
  }, [items, hiddenItems])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  useEffect(() => {
    fetch('/api/devices')
      .then(res => res.json())
      .then(data => {
        if (data.devices) {
          // Filter out ifb0 interface
          const filteredDevices = data.devices.filter((device: NetworkInterface) => device.name !== 'ifb0')
          setInterfaces(filteredDevices)
          // Update items state to include network interfaces while preserving order of non-device items
          setItems(current => {
            const nonDeviceItems = current.filter(item => !item.startsWith('device_'))
            const existingDeviceItems = current.filter(item => item.startsWith('device_'))
            const newDeviceItems = filteredDevices
              .map((device: NetworkInterface) => `device_${device.name}`)
              .filter((deviceId: string) => !existingDeviceItems.includes(deviceId))
            return [...nonDeviceItems, ...existingDeviceItems, ...newDeviceItems]
          })
        }
      })
      .catch(() => console.error('Failed to load devices'))
  }, [])

  // Add this effect to fetch and check version
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('/api/version');
        const { version } = await response.json();
        
        const savedVersion = localStorage.getItem('betaDashboardVersion');
        
        if (!savedVersion || savedVersion !== version) {
          // Version mismatch or first run - reset dashboard
          // console.log('Version mismatch or first run - resetting dashboard layout')
          localStorage.removeItem('betaDashboardOrder')
          localStorage.removeItem('betaDashboardHidden')
          localStorage.setItem('betaDashboardVersion', version);
          setItems(DEFAULT_ITEMS);
          setHiddenItems(new Set());
        }
      } catch (error) {
        console.error('Failed to check version:', error);
      }
    };

    checkVersion();
  }, []);

  const colors = [
    { light: '#10b981', dark: '#059669' }, // green
    { light: '#3b82f6', dark: '#2563eb' }, // blue
    { light: '#06b6d4', dark: '#0891b2' }, // cyan
    { light: '#8b5cf6', dark: '#7c3aed' }  // purple
  ]

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    if (!isEditMode) return
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id.toString())
        const newIndex = items.indexOf(over.id.toString())
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const toggleVisibility = (id: string) => {
    setHiddenItems(current => {
      const newHidden = new Set(current)
      if (newHidden.has(id)) {
        newHidden.delete(id)
      } else {
        newHidden.add(id)
      }
      return newHidden
    })
  }

  const getNetworkCardData = (iface: string): IfstatData[] => {
    const stats = networkStats[iface]
    if (!stats || stats.length === 0) {
      return [{
        timestamp: new Date().toISOString(),
        interface: iface,
        kbIn: 0,
        kbOut: 0
      }]
    }

    return stats.map(stat => ({
      timestamp: new Date(stat.timestamp).toISOString(),
      interface: stat.interface,
      kbIn: stat.kbIn,
      kbOut: stat.kbOut
    }))
  }

  const renderComponent = (id: string) => {
    if (hiddenItems.has(id)) return null

    switch (id) {
      case 'systemMonitor':
        return <ErrorBoundary><SystemMonitor /></ErrorBoundary>
      case 'interfaceStatus':
        return <ErrorBoundary><InterfaceStatusCard /></ErrorBoundary>
      case 'pingPrimary':
        return <ErrorBoundary><PingStatsCard color="#3b82f6" server="PRIMARY" /></ErrorBoundary>
      case 'pingSecondary':
        if (isPingDataLoading) {
          return <div>Loading...</div>;
        }
        if (!networkConfig?.SECONDARY_INTERFACE) {
          return null;
        }
        return <ErrorBoundary><PingStatsCard color="#10b981" server="SECONDARY" /></ErrorBoundary>
      case 'speedTest':
        return <ErrorBoundary><SpeedTestNew /></ErrorBoundary>
      case 'connectionTuning':
        return <ErrorBoundary><ConnectionTuningNew /></ErrorBoundary>
      case 'reservations':
        return <ErrorBoundary><ReservationsCard /></ErrorBoundary>
      case 'leases':
        return <ErrorBoundary><LeasesCard /></ErrorBoundary>
      case 'weather':
        return <ErrorBoundary><WeatherCard /></ErrorBoundary>
      case 'processes':
        return <ErrorBoundary><ServicesCard /></ErrorBoundary>
      case 'sambaShares':
        return <ErrorBoundary><SambaSharesCard /></ErrorBoundary>
      case 'dnsClients':
        return <ErrorBoundary><DnsClientsCard /></ErrorBoundary>
      case 'routeToSecondary':
        return <ErrorBoundary><RouteHostToSecondary /></ErrorBoundary>
      case 'portForwards':
        return <ErrorBoundary><PortForwards /></ErrorBoundary>
      case 'dnsHosts':
        return <ErrorBoundary><DnsHosts /></ErrorBoundary>
      case 'piholeLists':
        return <ErrorBoundary><PiholeLists /></ErrorBoundary>
      case 'bandwidth':
        return <ErrorBoundary><BandwidthUsage /></ErrorBoundary>
      case 'systemSettings':
        return <ErrorBoundary><SystemSettingsCard /></ErrorBoundary>
      case 'blockClients':
        return <ErrorBoundary><BlockClientsCard /></ErrorBoundary>
      case 'sshKeys':
        return <ErrorBoundary><SshKeysCard /></ErrorBoundary>
      case 'clock':
        return <ErrorBoundary><Clock /></ErrorBoundary>
      default:
        if (id.startsWith('device_')) {
          const deviceName = id.replace('device_', '')
          const device = interfaces.find(i => i.name === deviceName)
          if (!device) return null
          
          const colorIndex = interfaces.findIndex(i => i.name === deviceName) % colors.length
          return (
            <ErrorBoundary>
              <NetworkStatsCard
                data={getNetworkCardData(deviceName)}
                label={device.label || device.name}
                color={isDarkMode ? colors[colorIndex].dark : colors[colorIndex].light}
                fetchStats={() => {}}
                error={null}
                loading={false}
              />
            </ErrorBoundary>
          )
        }
        return null
    }
  }

  const visibleItems = items
    .filter(id => !hiddenItems.has(id))
    .filter(id => {
      if (id === 'pingSecondary') {
        return networkConfig?.SECONDARY_INTERFACE !== undefined && 
               networkConfig?.SECONDARY_INTERFACE !== "";
      }
      return true;
    });

  const getComponentLabel = (id: string) => {
    switch (id) {
      case 'systemMonitor':
        return 'System Monitor'
      case 'interfaceStatus':
        return 'Cake Status'
      case 'pingPrimary':
        return 'Primary Ping Stats'
      case 'speedTest':
        return 'Speed Test'
      case 'connectionTuning':
        return 'Connection Settings'
      case 'reservations':
        return 'DHCP Reservations'
      case 'leases':
        return 'Leases'
      case 'weather':
        return 'Weather'
      case 'processes':
        return 'System Services'
      case 'sambaShares':
        return 'Samba Shares'
      case 'dnsClients':
        return 'DNS Clients'
      case 'routeToSecondary':
        return 'Route to Secondary'
      case 'portForwards':
        return 'Port Forwards'
      case 'dnsHosts':
        return 'DNS Hosts'
      case 'piholeLists':
        return 'Pi-hole Lists'
      case 'bandwidth':
        return 'Bandwidth Usage'
      case 'systemSettings':
        return 'System Settings'
      case 'blockClients':
        return 'Block Clients'
      case 'sshKeys':
        return 'SSH Keys'
      case 'clock':
        return 'Clock'
      default:
        if (id.startsWith('device_')) {
          const deviceName = id.replace('device_', '')
          const device = interfaces.find(d => d.name === deviceName)
          return device?.label || deviceName
        }
        return id
    }
  }

  // Add back hiddenItemsList
  const hiddenItemsList = items.filter(id => hiddenItems.has(id))

  return (
    <>
      <div className="p-4">
        <div className="space-y-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={visibleItems} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 auto-rows-[250px] gap-3">
                {visibleItems.map((id) => (
                  <SortableItem 
                    key={id} 
                    id={id} 
                    isEditMode={isEditMode}
                    className={
                      id === 'reservations' || id === 'leases' || id === 'weather' || id === 'processes' || 
                      id === 'sambaShares' || id === 'dnsClients' || id === 'piholeLists' || id === 'bandwidth' || 
                      id === 'systemSettings' || id === 'blockClients' 
                        ? 'row-span-2 col-span-2'
                        : id === 'clock' || id === 'interfaceStatus'
                        ? 'row-span-1 col-span-1'
                        : 'row-span-1 col-span-2'
                    }
                  >
                    <div className="relative h-full">
                      {isEditMode && (
                        <button
                          onClick={() => toggleVisibility(id)}
                          className="absolute top-2 left-2 z-20 p-1 btn btn-red rounded-full"
                          title={`Hide ${getComponentLabel(id)}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      )}
                      {renderComponent(id)}
                    </div>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
      
      {isEditMode && hiddenItemsList.length > 0 && (
        <div className="p-4 border-t">
          <h3 className="text-label mb-2">Hidden Components</h3>
          <div className="flex flex-wrap gap-2">
            {hiddenItemsList.map(id => (
              <button
                key={id}
                onClick={() => toggleVisibility(id)}
                className="px-2 py-1 text-small bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {getComponentLabel(id)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

const DashboardWithErrorBoundary = () => {
  return (
    <ErrorBoundary>
      <CombinedDashboard />
    </ErrorBoundary>
  )
}

export default DashboardWithErrorBoundary