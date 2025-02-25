import { useState, useEffect } from 'react'

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

interface InterfaceStats {
  [key: string]: StoredNetworkStats[]
}

export function useNetworkStats() {
  const [networkStats, setNetworkStats] = useState<InterfaceStats>({})
  const [error, setError] = useState<string | null>(null)

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

    eventSource.onerror = (error) => {
      console.error('Network stats SSE error:', error)
      setError('Failed to connect to network stats stream')
    }

    return () => {
      eventSource.close()
    }
  }, [])

  return { networkStats, error }
} 