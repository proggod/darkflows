'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

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
  qos_enabled: boolean
  cake_enabled: boolean
}

interface NetworkDevice {
  name: string
  type?: 'primary' | 'secondary' | 'internal'
  label?: string
}

interface InterfaceStatusCardProps {
  title?: string
}

const formatMemory = (bytes: number): string => {
  if (bytes === 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)}${units[i]}`;
};

export default function InterfaceStatusCard({ title = 'Cake Status' }: InterfaceStatusCardProps) {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [deviceLabels, setDeviceLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qosEnabled, setQosEnabled] = useState(false)
  const [cakeEnabled, setCakeEnabled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setLoading(true)
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status')
      const data = await response.json()
      setStatus(data)
      setQosEnabled(data.qos_enabled || false)
      setCakeEnabled(data.cake_enabled || false)
      setError(null)
    } catch (error) {
      console.error('Failed to fetch cake status:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleQos = async () => {
    try {
      const response = await fetch('/api/qos', {
        method: 'POST',
        body: JSON.stringify({ enabled: !qosEnabled })
      })
      if (!response.ok) throw new Error('Failed to toggle QoS')
      setQosEnabled(!qosEnabled)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to toggle QoS')
    }
  }

  const toggleCake = async () => {
    try {
      const response = await fetch('/api/cake', {
        method: 'POST',
        body: JSON.stringify({ enabled: !cakeEnabled })
      })
      if (!response.ok) throw new Error('Failed to toggle Cake')
      setCakeEnabled(!cakeEnabled)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to toggle Cake')
    }
  }

  useEffect(() => {
    const fetchDeviceLabels = async () => {
      try {
        const response = await fetch('/api/devices')
        const data = await response.json()
        const labels: Record<string, string> = {}
        
        data.devices.forEach((device: NetworkDevice) => {
          labels[device.name] = device.label || device.name
        })
        
        labels['ifb0'] = 'InBound'
        setDeviceLabels(labels)
      } catch (error) {
        console.error('Failed to fetch device labels:', error)
      }
    }

    fetchDeviceLabels()
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  if (!mounted) {
    return (
      <div className="p-3 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-label">{title}</h3>
        </div>
        <div className="text-center py-4 text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label">{title}</h3>
        <RefreshCw 
          onClick={fetchStatus}
          className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-muted">Loading interface status...</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="space-y-2">
            {status?.interfaces && Object.entries(status.interfaces).map(([iface, stats]) => (
              <div key={iface} className="flex items-center justify-between p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stats.new_drops > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-small">{deviceLabels[iface] || iface}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-muted">
                    {stats.memory > 0 ? formatMemory(stats.memory) : ''}
                  </div>
                  <div className="text-muted min-w-[60px] text-right">
                    {stats.new_drops > 0 ? `${stats.new_drops} drops` : 'OK'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Settings */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <span className="text-small">QoS</span>
              <button
                onClick={toggleQos}
                className={`btn ${qosEnabled ? 'btn-green' : 'btn-red'}`}
              >
                {qosEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <span className="text-small">Cake</span>
              <button
                onClick={toggleCake}
                className={`btn ${cakeEnabled ? 'btn-green' : 'btn-red'}`}
              >
                {cakeEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}