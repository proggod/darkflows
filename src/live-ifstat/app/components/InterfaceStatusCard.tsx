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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setLoading(true)
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status')
      const data = await response.json()
      console.log('Status data:', data)
      setStatus(data)
      setError(null)
    } catch (error) {
      console.error('Failed to fetch cake status:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [])

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
    <div className="p-2 h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-label">{title}</h3>
        <RefreshCw 
          onClick={fetchStatus}
          className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-1 text-small">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-2 text-muted">Loading interface status...</div>
      ) : (
        <div>
          <div className="space-y-1">
            {status?.interfaces && Object.entries(status.interfaces).map(([iface, stats]) => (
              <div key={iface} className="flex items-center justify-between p-1 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${stats.new_drops > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                  <span className="text-xs">{deviceLabels[iface] || iface}</span>
                </div>
                <div className="flex items-center">
                  <div className="text-muted text-xs">
                    {stats.memory > 0 ? formatMemory(stats.memory) : ''}
                  </div>
                  <div className="text-muted text-xs min-w-[80px] text-right">
                    {`${stats.new_drops} drops`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
