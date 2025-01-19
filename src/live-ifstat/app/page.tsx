'use client'

import { useState, useEffect } from 'react'
import SystemMonitor from '@/components/SystemMonitor'
import SpeedTestNew from '@/components/SpeedTestNew'
import PingStatsCard from '@/components/PingStatsCard'
import NetworkStatsCard from '@/components/NetworkStatsCard'
import ConnectionTuningNew from '@/components/ConnectionTuningNew'
import InterfaceStatusCard from '@/components/InterfaceStatusCard'
import { useEditMode } from '@/contexts/EditModeContext'
import { useTheme } from '@/contexts/ThemeContext'
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

const DEFAULT_ITEMS = ['systemMonitor', 'interfaceStatus', 'pingPrimary', 'pingSecondary', 'speedTest', 'connectionTuning']

// Add a version list of all available components to detect when new ones are added
const COMPONENTS_VERSION = [
  'systemMonitor',
  'interfaceStatus', 
  'pingPrimary',
  'pingSecondary',
  'speedTest',
  'connectionTuning'
]

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
        const savedVersion = localStorage.getItem('betaDashboardVersion')
        
        // Check if saved version matches current version
        if (savedVersion === JSON.stringify(COMPONENTS_VERSION)) {
          if (savedOrder) {
            setItems(JSON.parse(savedOrder))
          }
          if (savedHidden) {
            setHiddenItems(new Set(JSON.parse(savedHidden)))
          }
        } else {
          // Version mismatch - reset to defaults
          console.log('Dashboard components changed - resetting layout')
          localStorage.removeItem('betaDashboardOrder')
          localStorage.removeItem('betaDashboardHidden')
          setItems(DEFAULT_ITEMS)
          setHiddenItems(new Set())
          // Save new version
          localStorage.setItem('betaDashboardVersion', JSON.stringify(COMPONENTS_VERSION))
        }
      } catch (e) {
        console.error('Failed to load saved dashboard state:', e)
      }
    }

    loadSavedState()
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('betaDashboardOrder', JSON.stringify(items))
    localStorage.setItem('betaDashboardHidden', JSON.stringify(Array.from(hiddenItems)))
    localStorage.setItem('betaDashboardVersion', JSON.stringify(COMPONENTS_VERSION))
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
    switch (id) {
      case 'systemMonitor':
        return <SystemMonitor />
      case 'interfaceStatus':
        return <InterfaceStatusCard />
      case 'pingPrimary':
        return (
          <PingStatsCard
            server="PRIMARY"
            color={isDarkMode ? '#2563eb' : '#3b82f6'}
          />
        )
      case 'pingSecondary':
        return (
          <PingStatsCard
            server="SECONDARY"
            color={isDarkMode ? '#0891b2' : '#06b6d4'}
          />
        )
      case 'speedTest':
        return <SpeedTestNew />
      case 'connectionTuning':
        return <ConnectionTuningNew />
      default:
        if (id.startsWith('device_')) {
          const deviceName = id.replace('device_', '')
          const device = interfaces.find(d => d.name === deviceName)
          if (!device) return null
          const index = interfaces.indexOf(device)
          return (
            <NetworkStatsCard
              key={device.name}
              label={device.label || device.name}
              color={colors[index % colors.length][isDarkMode ? 'dark' : 'light']}
              data={getNetworkCardData(device.name)}
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
    <div className="p-0 mx-5 mt-14">
      <div className="space-y-8 mx-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleItems} strategy={rectSortingStrategy}>
            <div className="grid gap-3 px-4 dashboard-grid">
              {visibleItems.map((id) => (
                <SortableItem key={id} id={id} isEditMode={isEditMode}>
                  <div className="relative">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hiddenItemsList.map(id => (
                <div key={id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded shadow-sm hover:shadow dark:shadow-gray-900">
                  <button
                    onClick={() => toggleVisibility(id)}
                    className="p-1 bg-green-500 dark:bg-green-600 text-white rounded-full hover:bg-green-600 dark:hover:bg-green-700 flex-shrink-0"
                    title={`Show ${getComponentLabel(id)}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {getComponentLabel(id)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
