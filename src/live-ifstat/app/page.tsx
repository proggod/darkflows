'use client'

import { useState, useEffect, useRef } from 'react'
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

interface IfstatData {
  timestamp: string
  interface: string
  kbIn: number
  kbOut: number
}

const DEFAULT_ITEMS = [
  'systemMonitor',
  'clock',
  'interfaceStatus',
  'pingPrimary',
  'networkPrimary',
  'pingSecondary',
  'networkSecondary',
  'networkInternal',
  'connectionTuning',
  'systemSettings',
  'weather',
  'reservations',
  'leases',
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
  'speedTest',
]

console.log('Debug DEFAULT_ITEMS:', {
  hasNetworkPrimary: DEFAULT_ITEMS.includes('networkPrimary'),
  hasNetworkSecondary: DEFAULT_ITEMS.includes('networkSecondary'),
  hasNetworkInternal: DEFAULT_ITEMS.includes('networkInternal'),
  fullList: DEFAULT_ITEMS
});

const CombinedDashboard = () => {
  const { networkStats } = useNetworkStats()
  const { isEditMode } = useEditMode()
  const { isDarkMode } = useTheme()
  const { networkConfig, isLoading: isPingDataLoading } = usePingData()
  const initialLoadComplete = useRef(false)
  const deviceUpdatePending = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const [items, setItems] = useState<string[]>(DEFAULT_ITEMS)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())

  // Save layout changes to localStorage
  useEffect(() => {
    if (!initialLoadComplete.current) return; // Don't save during initial load
    
    try {
      console.log('DEBUG: Saving layout to localStorage', items);
      localStorage.setItem('betaDashboardOrder', JSON.stringify(items));
      localStorage.setItem('betaDashboardHidden', JSON.stringify(Array.from(hiddenItems)));
    } catch (e) {
      console.error('Failed to save dashboard state:', e);
    }
  }, [items, hiddenItems]);

  // Load saved state from localStorage
  useEffect(() => {
    const loadSavedState = () => {
      try {
        if (initialLoadComplete.current) {
          return;
        }

        if (networkConfig === null || isPingDataLoading) {
          console.log('Debug loadSavedState: waiting for config', { 
            hasConfig: networkConfig !== null, 
            isPingDataLoading 
          });
          return;
        }

        console.log('Debug loadSavedState: config ready', networkConfig);

        const savedOrder = localStorage.getItem('betaDashboardOrder')
        console.log('DEBUG: Loading saved state', { 
          savedOrder,
          defaultItems: DEFAULT_ITEMS 
        });
        
        let newItems = DEFAULT_ITEMS;
        if (savedOrder) {
          const parsedOrder = JSON.parse(savedOrder)
          // Filter out device_ items but preserve network cards
          const filteredOrder = parsedOrder.filter((id: string) => 
            !id.startsWith('device_') || 
            ['networkPrimary', 'networkSecondary', 'networkInternal'].includes(id)
          )
          
          // Ensure network cards are present
          const networkCards = ['networkPrimary', 'networkSecondary', 'networkInternal']
          const missingCards = networkCards.filter(card => !filteredOrder.includes(card))
          
          if (missingCards.length > 0) {
            // Add missing network cards after their corresponding ping cards
            const newOrder = [...filteredOrder]
            missingCards.forEach(card => {
              if (card === 'networkPrimary') {
                const pingIndex = newOrder.indexOf('pingPrimary')
                if (pingIndex !== -1) {
                  newOrder.splice(pingIndex + 1, 0, card)
                } else {
                  newOrder.push(card)
                }
              } else if (card === 'networkSecondary') {
                const pingIndex = newOrder.indexOf('pingSecondary')
                if (pingIndex !== -1) {
                  newOrder.splice(pingIndex + 1, 0, card)
                } else {
                  newOrder.push(card)
                }
              } else {
                newOrder.push(card)
              }
            })
            newItems = newOrder
          } else {
            newItems = filteredOrder
          }
        }
        
        console.log('Debug: Final items after ensuring network cards:', newItems);
        setItems(newItems);

        const savedHidden = localStorage.getItem('betaDashboardHidden')
        if (savedHidden) {
          const parsedHidden = JSON.parse(savedHidden)
          // Filter out any old device_ prefixed items
          const filteredHidden = parsedHidden.filter((id: string) => !id.startsWith('device_'))
          setHiddenItems(new Set(filteredHidden))
        }

        initialLoadComplete.current = true
        setIsLoading(false)
      } catch (error) {
        console.error('DEBUG: Error loading saved dashboard state:', error)
        console.log('Debug: Falling back to DEFAULT_ITEMS');
        setItems(DEFAULT_ITEMS);
        initialLoadComplete.current = true;
        setIsLoading(false);
      }
    }

    loadSavedState()
  }, [networkConfig, isPingDataLoading])

  // Fetch devices after initial load
  useEffect(() => {
    if (!networkConfig || !initialLoadComplete.current || !deviceUpdatePending.current) return;
    deviceUpdatePending.current = false;
    setIsLoading(false);
  }, [networkConfig]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  // First, let's modify the version check effect to be more aggressive
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('/api/version');
        const { version } = await response.json();
        
        // Always force a reset to ensure network cards are present
        console.log('Debug: Forcing dashboard reset');
        localStorage.clear(); // Clear all localStorage
        setItems(DEFAULT_ITEMS);
        setHiddenItems(new Set());
        localStorage.setItem('betaDashboardVersion', version);
        localStorage.setItem('betaDashboardOrder', JSON.stringify(DEFAULT_ITEMS));
        console.log('Debug: Reset complete, new items:', DEFAULT_ITEMS);
        
      } catch (error) {
        console.error('Failed to check version:', error);
      }
    };

    checkVersion();
  }, []);

  // Add debug logging for networkConfig and networkStats
  useEffect(() => {
    console.log('Debug networkConfig:', networkConfig)
    console.log('Debug networkStats:', networkStats)
  }, [networkConfig, networkStats])

  // Add this debug effect
  useEffect(() => {
    console.log('Debug network cards:', {
      networkConfig,
      hasNetworkPrimary: items.includes('networkPrimary'),
      hasNetworkSecondary: items.includes('networkSecondary'),
      hasNetworkInternal: items.includes('networkInternal'),
      primaryInterface: networkConfig?.PRIMARY_INTERFACE,
      secondaryInterface: networkConfig?.SECONDARY_INTERFACE,
      internalInterface: networkConfig?.INTERNAL_INTERFACE,
    });
  }, [networkConfig, items]);

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
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id.toString());
        const newIndex = items.indexOf(over.id.toString());
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        console.log('DEBUG: Drag end - updating order', {
          oldIndex,
          newIndex,
          oldOrder: items,
          newOrder
        });
        
        // Force a save to localStorage immediately after drag
        try {
          localStorage.setItem('betaDashboardOrder', JSON.stringify(newOrder));
          console.log('DEBUG: Saved new order after drag');
        } catch (e) {
          console.error('Failed to save order after drag:', e);
        }
        
        return newOrder;
      });
    }
  }

  // Add a debug effect to monitor items changes
  useEffect(() => {
    console.log('DEBUG: Items changed', {
      items,
      savedOrder: localStorage.getItem('betaDashboardOrder')
    });
  }, [items]);

  // Modify the save effect to be more robust
  useEffect(() => {
    if (!initialLoadComplete.current) {
      console.log('DEBUG: Skipping save - initial load not complete');
      return;
    }
    
    try {
      const currentSaved = localStorage.getItem('betaDashboardOrder');
      const newOrder = JSON.stringify(items);
      
      if (currentSaved !== newOrder) {
        console.log('DEBUG: Saving new layout', {
          old: JSON.parse(currentSaved || '[]'),
          new: items
        });
        localStorage.setItem('betaDashboardOrder', newOrder);
        localStorage.setItem('betaDashboardHidden', JSON.stringify(Array.from(hiddenItems)));
      } else {
        console.log('DEBUG: Skipping save - no changes');
      }
    } catch (e) {
      console.error('Failed to save dashboard state:', e);
    }
  }, [items, hiddenItems]);

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

  // Add getNetworkCardData function that was missing
  const getNetworkCardData = (iface: string): IfstatData[] => {
    console.log('Debug getNetworkCardData:', { iface, stats: networkStats[iface] })
    const stats = networkStats[iface]
    if (!stats || stats.length === 0) {
      console.log('Debug: No stats found for interface', iface)
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
    // Add debug log for every component render attempt
    console.log('Debug renderComponent:', { 
      id, 
      isHidden: hiddenItems.has(id),
      isInItems: items.includes(id),
      networkConfig: networkConfig ? {
        PRIMARY_INTERFACE: networkConfig.PRIMARY_INTERFACE,
        SECONDARY_INTERFACE: networkConfig.SECONDARY_INTERFACE,
        INTERNAL_INTERFACE: networkConfig.INTERNAL_INTERFACE
      } : null
    });

    if (hiddenItems.has(id)) {
      console.log('Debug: Component hidden:', id);
      return null;
    }

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
      case 'networkPrimary':
        console.log('Debug networkPrimary detailed:', {
          interface: networkConfig?.PRIMARY_INTERFACE,
          label: networkConfig?.PRIMARY_LABEL,
          hasConfig: !!networkConfig,
          isPingDataLoading,
          isInItems: items.includes('networkPrimary'),
          isHidden: hiddenItems.has('networkPrimary'),
          networkStats: networkStats[networkConfig?.PRIMARY_INTERFACE || ''],
          items: items,
          DEFAULT_ITEMS: DEFAULT_ITEMS
        });
        
        if (!networkConfig?.PRIMARY_INTERFACE) {
          console.log('Debug: No PRIMARY_INTERFACE found');
          return null;
        }
        
        const primaryData = getNetworkCardData(networkConfig.PRIMARY_INTERFACE);
        console.log('Debug: Primary network data:', primaryData);
        
        return (
          <ErrorBoundary>
            <NetworkStatsCard
              data={primaryData}
              label={networkConfig.PRIMARY_LABEL || networkConfig.PRIMARY_INTERFACE}
              color={isDarkMode ? colors[0].dark : colors[0].light}
              fetchStats={() => {}}
              error={null}
              loading={false}
            />
          </ErrorBoundary>
        );
      case 'networkSecondary':
        if (!networkConfig?.SECONDARY_INTERFACE) return null;
        return (
          <ErrorBoundary>
            <NetworkStatsCard
              data={getNetworkCardData(networkConfig.SECONDARY_INTERFACE)}
              label={networkConfig.SECONDARY_LABEL || networkConfig.SECONDARY_INTERFACE}
              color={isDarkMode ? colors[1].dark : colors[1].light}
              fetchStats={() => {}}
              error={null}
              loading={false}
            />
          </ErrorBoundary>
        );
      case 'networkInternal':
        if (!networkConfig?.INTERNAL_INTERFACE) return null;
        return (
          <ErrorBoundary>
            <NetworkStatsCard
              data={getNetworkCardData(networkConfig.INTERNAL_INTERFACE)}
              label={networkConfig.INTERNAL_LABEL || networkConfig.INTERNAL_INTERFACE}
              color={isDarkMode ? colors[2].dark : colors[2].light}
              fetchStats={() => {}}
              error={null}
              loading={false}
            />
          </ErrorBoundary>
        );
      default:
        return null
    }
  }

  // Add debug logging in visibleItems filter
  const visibleItems = items
    .filter(id => {
      const isHidden = hiddenItems.has(id)
      console.log('Debug visibility filter:', { 
        id, 
        isHidden,
        isInItems: items.includes(id),
        isNetworkCard: ['networkPrimary', 'networkSecondary', 'networkInternal'].includes(id)
      })
      return !isHidden
    })
    .filter(id => {
      switch (id) {
        case 'pingSecondary':
        case 'networkSecondary':
          const hasSecondary = networkConfig?.SECONDARY_INTERFACE !== undefined && 
                             networkConfig?.SECONDARY_INTERFACE !== "";
          console.log('Debug secondary filter:', { id, hasSecondary, interface: networkConfig?.SECONDARY_INTERFACE })
          return hasSecondary;
        case 'networkInternal':
          const hasInternal = networkConfig?.INTERNAL_INTERFACE !== undefined && 
                            networkConfig?.INTERNAL_INTERFACE !== "";
          console.log('Debug internal filter:', { id, hasInternal, interface: networkConfig?.INTERNAL_INTERFACE })
          return hasInternal;
        default:
          return true;
      }
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
      case 'networkPrimary':
        return 'Primary Network Stats'
      case 'networkSecondary':
        return 'Secondary Network Stats'
      case 'networkInternal':
        return 'Internal Network Stats'
      default:
        return id
    }
  }

  // Add back hiddenItemsList
  const hiddenItemsList = items.filter(id => hiddenItems.has(id))

  if (isLoading) {
    return <div className="p-4">Loading dashboard...</div>
  }

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