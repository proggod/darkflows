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

interface InterfaceStatusCardProps {
  title?: string
}

export default function InterfaceStatusCard({ title = 'Cake Status' }: InterfaceStatusCardProps) {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [deviceLabels, setDeviceLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchDeviceLabels = async () => {
      try {
        const response = await fetch('/api/devices')
        const data = await response.json()
        const labels: Record<string, string> = {}
        
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
        setStatus(data)
      } catch (error) {
        console.error('Failed to fetch cake status:', error)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!status) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 shadow-sm transition-colors duration-200 h-card">
        <div className="p-1">
          <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h2>
          <div className="text-[10px] text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 shadow-sm transition-colors duration-200 h-card">
      <div className="flex flex-col h-full">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">{title}</h2>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1 px-1 sticky top-0 bg-gray-50 dark:bg-gray-800">
            <div>Interface</div>
            <div>Status</div>
            <div>Backlog</div>
            <div>Memory</div>
          </div>
          {Object.entries(status.interfaces).map(([iface, stats]) => (
            <div key={iface} className="grid grid-cols-4 gap-2 text-[10px] py-1 px-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
              <div className="font-medium text-gray-900 dark:text-gray-100">{deviceLabels[iface] || iface}</div>
              <div>
                <span className={`px-1.5 py-0.5 rounded ${stats.new_drops > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'}`}>
                  {stats.new_drops > 0 ? `${stats.new_drops} drops` : 'OK'}
                </span>
              </div>
              <div className="text-gray-900 dark:text-gray-100">{stats.backlog}</div>
              <div className="text-gray-900 dark:text-gray-100">{(stats.memory / 1024).toFixed(1)} KB</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 mt-1 px-1">
          Last updated: {new Date(status.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  )
} 