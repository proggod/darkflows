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

  useEffect(() => {
    // Fetch device config first
    const fetchDeviceLabels = async () => {
      try {
        const response = await fetch('/api/devices')
        const data = await response.json()
        const labels: Record<string, string> = {}
        
        // Process devices and create label mapping
        data.devices.forEach((device: NetworkDevice) => {
          labels[device.name] = device.label || device.name
        })
        
        // Add special case for ifb0
        labels['ifb0'] = 'InBound'
        
        setDeviceLabels(labels)
      } catch (error) {
        console.error('Failed to fetch device labels:', error)
      }
    }

    fetchDeviceLabels()
  }, [])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status')
        const data = await response.json()
        if (data.error) {
          setError(data.error)
        } else {
          setStatus(data)
        }
      } catch (error) {
        console.error('Failed to fetch status:', error)
        setError('Failed to fetch status')
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
    return <div className="text-red-600">Error: {error}</div>
  }

  if (!status) {
    return <div className="text-gray-700">Loading status...</div>
  }

  // Format memory to MB with 2 decimal places
  const formatMemory = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2)

  return (
    <div className="bg-white p-4 border rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">CAKE Statistics</h2>
        <div className="text-sm text-gray-600">
          Last Update: {new Date(status.timestamp).toLocaleTimeString()}
        </div>
      </div>
      
      <div className="space-y-4">
        {Object.entries(status.interfaces).map(([iface, stats]) => (
          <div key={iface} className="border-b pb-2 last:border-b-0">
            <h3 className="font-medium text-gray-800">
              {deviceLabels[iface] || iface}
            </h3>
            <div className="grid grid-cols-3 gap-4 mt-1 text-sm">
              <div>
                <span className="text-gray-600">Drops: </span>
                <span className={stats.new_drops > 0 ? 'text-red-600' : 'text-gray-900'}>
                  {stats.new_drops.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Backlog: </span>
                <span className={stats.backlog > 0 ? 'text-yellow-600' : 'text-gray-900'}>
                  {stats.backlog.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Memory: </span>
                <span className="text-gray-900">{formatMemory(stats.memory)} MB</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 