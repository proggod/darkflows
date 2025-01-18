'use client'

import { useState, useEffect } from 'react'
import SystemMonitor from '../components/SystemMonitor'
import SpeedTestNew from '../components/SpeedTestNew'
import ThemeToggle from '../components/ThemeToggle'
import PingStatsCard from '../components/PingStatsCard'
import NetworkStatsCard from '../components/NetworkStatsCard'

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

export default function CombinedDashboard() {
  const [isDark, setIsDark] = useState(true)
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [networkStats, setNetworkStats] = useState<InterfaceStats>({})
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

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
        }
      })
      .catch(() => console.error('Failed to load devices'))
  }, [])

  const toggleTheme = () => setIsDark(!isDark)

  const colors = [
    { light: '#10b981', dark: '#059669' }, // green
    { light: '#3b82f6', dark: '#2563eb' }, // blue
    { light: '#06b6d4', dark: '#0891b2' }, // cyan
    { light: '#8b5cf6', dark: '#7c3aed' }  // purple
  ];

  return (
    <div className="p-4">
      <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
      <div className="space-y-8 mx-auto">
        <div className="grid gap-3 px-4 dashboard-grid">
          <SystemMonitor />
          <PingStatsCard
            server="PRIMARY"
            color={isDark ? '#2563eb' : '#3b82f6'}
          />
          <PingStatsCard
            server="SECONDARY"
            color={isDark ? '#0891b2' : '#06b6d4'}
          />
          {interfaces.map((iface, index) => (
            <NetworkStatsCard
              key={iface.name}
              label={iface.label || iface.name}
              color={colors[index % colors.length][isDark ? 'dark' : 'light']}
              data={getNetworkCardData(iface.name)}
            />
          ))}
          <SpeedTestNew />
        </div>
      </div>
    </div>
  )
}
