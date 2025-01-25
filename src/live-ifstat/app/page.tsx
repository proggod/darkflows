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

interface NetworkInterface {
  name: string
  speed?: string
  label?: string
  type?: 'primary' | 'secondary' | 'internal'
}

interface RawNetworkStats {
  timestamp: string
  kbIn: number
  kbOut: number
  device: string
}

interface StoredNetworkStats {
  timestamp: number
  kbIn: number
  kbOut: number
  interface: string
}

type IfstatData = {
  timestamp: string
  interface: string
  kbIn: number
  kbOut: number
}

interface InterfaceStats {
  [key: string]: StoredNetworkStats[]
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
  'dnsClients',
  'blockClients',
  'routeToSecondary',
  'portForwards',
  'dnsHosts',
  'piholeLists',
  'bandwidth',
  'systemSettings'
]

function ViewportDisplay() {
  const [width, setWidth] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    // Set initial width
    setWidth(window.innerWidth);
    
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (width === undefined) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-full z-50">
      Width: {width}px
    </div>
  );
}

export default function CombinedDashboard() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [networkStats, setNetworkStats] = useState<InterfaceStats>({})
  const { isEditMode } = useEditMode()
  const { isDarkMode } = useTheme()
  
  const [items, setItems] = useState<string[]>(DEFAULT_ITEMS)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())

  // Load saved state from localStorage
  useEffect(() => {
    const loadSavedState = () => {
      try {
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
          console.log('Missing components in dashboard - resetting layout')
          localStorage.removeItem('betaDashboardOrder')
          localStorage.removeItem('betaDashboardHidden')
          localStorage.removeItem('betaDashboardVersion')
          setItems(DEFAULT_ITEMS)
          setHiddenItems(new Set())
        }
      } catch (e) {
        console.error('Failed to load saved dashboard state:', e)
        // Reset to defaults on error
        localStorage.removeItem('betaDashboardOrder')
        localStorage.removeItem('betaDashboardHidden')
        localStorage.removeItem('betaDashboardVersion')
        setItems(DEFAULT_ITEMS)
        setHiddenItems(new Set())
      }
    }

    loadSavedState()
  }, [])

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
    const eventSource = new EventSource('/api/ifstat-stream')

    eventSource.onmessage = (event) => {
      const stats = JSON.parse(event.data) as RawNetworkStats
      setNetworkStats(prevStats => {
        const newStats = { ...prevStats }
        const iface = stats.device
        
        if (!newStats[iface]) {
          newStats[iface] = []
        }
        
        // Convert timestamp to a full date string for today
        const now = new Date()
        const [time, period] = stats.timestamp.split(' ')
        const [hours, minutes, seconds] = time.split(':')
        let hour = parseInt(hours)
        
        // Convert 12-hour format to 24-hour
        if (period === 'PM' && hour !== 12) {
          hour += 12
        } else if (period === 'AM' && hour === 12) {
          hour = 0
        }
        
        now.setHours(hour, parseInt(minutes), parseInt(seconds))
        const currentTimestamp = now.getTime()
        
        // Only add new data point if it's different from the last one
        const lastStats = newStats[iface][newStats[iface].length - 1]
        if (!lastStats || 
            lastStats.kbIn !== stats.kbIn || 
            lastStats.kbOut !== stats.kbOut) {
          
          newStats[iface].push({
            timestamp: currentTimestamp,
            kbIn: stats.kbIn,
            kbOut: stats.kbOut,
            interface: iface
          })

          // Keep only last 20 data points
          if (newStats[iface].length > 20) {
            newStats[iface] = newStats[iface].slice(-20)
          }
        }
        
        return newStats
      })
    }

    return () => {
      eventSource.close()
    }
  }, [])

  // Transform stored stats into display format for the NetworkStatsCard
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

    // Convert stored stats to display format
    return stats.map(stat => ({
      timestamp: new Date(stat.timestamp).toISOString(),
      interface: stat.interface,
      kbIn: stat.kbIn,
      kbOut: stat.kbOut
    }))
  }

  useEffect(() => {
    fetch('/api/devices')
      .then(res => res.json())
      .then(data => {
        if (data.devices) {
          setInterfaces(data.devices)
          // Update items state to include network interfaces while preserving order of non-device items
          setItems(current => {
            const nonDeviceItems = current.filter(item => !item.startsWith('device_'))
            const existingDeviceItems = current.filter(item => item.startsWith('device_'))
            const newDeviceItems = data.devices
              .map((device: NetworkInterface) => `device_${device.name}`)
              .filter((deviceId: string) => !existingDeviceItems.includes(deviceId))
            return [...nonDeviceItems, ...existingDeviceItems, ...newDeviceItems]
          })
        }
      })
      .catch(() => console.error('Failed to load devices'))
  }, [])

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

  const renderComponent = (id: string) => {
    if (hiddenItems.has(id)) return null

    switch (id) {
      case 'systemMonitor':
        return <SystemMonitor />
      case 'interfaceStatus':
        return <InterfaceStatusCard />
      case 'pingPrimary':
        return <PingStatsCard server="PRIMARY" color={isDarkMode ? '#2563eb' : '#3b82f6'} />
      case 'pingSecondary':
        return <PingStatsCard server="SECONDARY" color={isDarkMode ? '#0891b2' : '#06b6d4'} />
      case 'speedTest':
        return <SpeedTestNew />
      case 'connectionTuning':
        return <ConnectionTuningNew />
      case 'reservations':
        return <ReservationsCard />
      case 'leases':
        return <LeasesCard />
      case 'weather':
        return <WeatherCard />
      case 'processes':
        return <ServicesCard />
      case 'sambaShares':
        return <SambaSharesCard />
      case 'dnsClients':
        return <DnsClientsCard />
      case 'routeToSecondary':
        return <RouteHostToSecondary />
      case 'portForwards':
        return <PortForwards />
      case 'dnsHosts':
        return <DnsHosts />
      case 'piholeLists':
        return <PiholeLists />
      case 'bandwidth':
        return <BandwidthUsage />
      case 'systemSettings':
        return <SystemSettingsCard />
      case 'blockClients':
        return <BlockClientsCard />
      default:
        if (id.startsWith('device_')) {
          const deviceName = id.replace('device_', '')
          const deviceData = getNetworkCardData(deviceName)
          const device = interfaces.find(i => i.name === deviceName)
          if (!device) return null
          
          const colorIndex = interfaces.findIndex(i => i.name === deviceName) % colors.length
          return (
            <NetworkStatsCard
              data={deviceData}
              label={device.label || device.name}
              color={isDarkMode ? colors[colorIndex].dark : colors[colorIndex].light}
            />
          )
        }
        return null
    }
  }

  const visibleItems = items.filter(id => !hiddenItems.has(id))
  const hiddenItemsList = items.filter(id => hiddenItems.has(id))

  const getComponentLabel = (id: string) => {
    switch (id) {
      case 'systemMonitor':
        return 'System Monitor'
      case 'interfaceStatus':
        return 'Cake Status'
      case 'pingPrimary':
        return 'Primary Ping Stats'
      case 'pingSecondary':
        return 'Secondary Ping Stats'
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
      default:
        if (id.startsWith('device_')) {
          const deviceName = id.replace('device_', '')
          const device = interfaces.find(d => d.name === deviceName)
          return device?.label || deviceName
        }
        return id
    }
  }

  return (
    <>
      <div className="p-0 mx-0 sm:mx-5 mt-14">
        <div className="space-y-8 mx-auto p-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={visibleItems} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 auto-rows-[250px] gap-3 px-4">
                {visibleItems.map((id) => (
                  <SortableItem 
                    key={id} 
                    id={id} 
                    isEditMode={isEditMode}
                    className={id === 'reservations' || id === 'leases' || id === 'weather' || id === 'processes' || 
                             id === 'sambaShares' || id === 'dnsClients' || id === 'piholeLists' || id === 'bandwidth' || 
                             id === 'systemSettings' || id === 'blockClients' ? 'row-span-2' : ''}
                  >
                    <div className="relative h-full">
                      {isEditMode && (
                        <button
                          onClick={() => toggleVisibility(id)}
                          className="absolute top-2 left-2 z-20 p-1 bg-red-500 dark:bg-red-600 text-white rounded-full hover:bg-red-600 dark:hover:bg-red-700"
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

          {isEditMode && hiddenItemsList.length > 0 && (
            <div className="mt-8 p-4 bg-gray-200 dark:bg-gray-800 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Hidden Components</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {hiddenItemsList.map(id => (
                  <div key={id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded shadow-sm hover:shadow dark:shadow-gray-900">
                    <button
                      onClick={() => toggleVisibility(id)}
                      className="p-1 bg-green-500 dark:bg-green-600 text-white rounded-full hover:bg-green-600 dark:hover:bg-green-700 flex-shrink-0"
                      title={`Show ${getComponentLabel(id)}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                    <span className="text-gray-900 dark:text-gray-100">{getComponentLabel(id)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <ViewportDisplay />
    </>
  )
}