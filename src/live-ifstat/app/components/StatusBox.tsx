'use client'

import { useEffect, useState } from 'react'

interface InterfaceStatus {
  new_drops: number
  backlog: number
  memory: number
}

interface StatusData {
  timestamp: string
  interfaces: {
    [key: string]: InterfaceStatus
  }
}

interface NetworkDevice {
  name: string
  type?: 'primary' | 'secondary' | 'internal'
  label?: string
}

export default function StatusBox() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceLabels, setDeviceLabels] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch device config first
    const fetchDeviceLabels = async () => {
      try {
        const response = await fetch('/api/devices')
        if (!response.ok) {
          throw new Error('Failed to fetch device labels')
        }
        const data = await response.json()
        const labels: Record<string, string> = {}
        
        // Process devices and create label mapping
        data.devices?.forEach((device: NetworkDevice) => {
          labels[device.name] = device.label || device.name
        })
        
        // Add special case for ifb0
        labels['ifb0'] = 'InBound'
        
        setDeviceLabels(labels)
      } catch (error) {
        console.error('Failed to fetch device labels:', error)
        // Don't set error state here as it's not critical
      }
    }

    fetchDeviceLabels()
  }, [])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/status')
        if (!response.ok) {
          throw new Error('Failed to fetch status')
        }
        const data = await response.json()
        if (data.error) {
          setError(data.error)
        } else if (!data.interfaces || typeof data.interfaces !== 'object') {
          throw new Error('Invalid status data format')
        } else {
          setStatus(data)
          setError(null)
        }
      } catch (error) {
        console.error('Failed to fetch status:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch status')
      } finally {
        setIsLoading(false)
      }
    }

    // Initial fetch
    fetchStatus()

    // Set up interval for updates
    const intervalId = setInterval(fetchStatus, 15000)

    // Cleanup on unmount
    return () => clearInterval(intervalId)
  }, [])

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 dark:text-red-400 mb-2">Error: {error}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Last updated: {status ? new Date(status.timestamp).toLocaleTimeString() : 'Never'}
        </div>
      </div>
    )
  }

  if (isLoading && !status) {
    return (
      <div className="p-4">
        <div className="text-gray-700 dark:text-gray-300">Loading status...</div>
      </div>
    )
  }

  if (!status || !status.interfaces) {
    return (
      <div className="p-4">
        <div className="text-gray-700 dark:text-gray-300">No status data available</div>
      </div>
    )
  }

  const formatMemory = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2)

  return (
    <div className="p-4 pt-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">CAKE Statistics</h2>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {new Date(status.timestamp).toLocaleTimeString()}
        </div>
      </div>
      
      <div className="space-y-2">
        {Object.entries(status.interfaces).map(([iface, stats]) => (
          <div key={iface} >
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {deviceLabels[iface] || iface}
            </div>
            <div className="grid grid-cols-3 mt-0.5 text-s">
              <div>
                <span className={`${stats.new_drops > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {stats.new_drops.toLocaleString()} drops
                </span>
              </div>
              <div>
                <span className={`${stats.backlog > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {stats.backlog.toLocaleString()} backlog
                </span>
              </div>
              <div>
                <span className="text-gray-900 dark:text-gray-100">{formatMemory(stats.memory)}MB</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 