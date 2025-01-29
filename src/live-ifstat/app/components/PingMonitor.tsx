'use client'

import { useEffect, useState } from 'react'
import PingChart from './PingChart'
import PingStats from './PingStats'

interface NetworkConfig {
  SECONDARY_INTERFACE: string;
  [key: string]: string;
}

export default function PingMonitor() {
  const [showSecondary, setShowSecondary] = useState<boolean>(true)

  useEffect(() => {
    const fetchNetworkConfig = async () => {
      try {
        const response = await fetch('/api/network-config')
        if (!response.ok) {
          console.error('Failed to fetch network config')
          return
        }
        const config: NetworkConfig = await response.json()
        
        console.log('=== PingMonitor Debug ===')
        console.log('Network config:', config)
        console.log('SECONDARY_INTERFACE:', config.SECONDARY_INTERFACE)
        
        setShowSecondary(config.SECONDARY_INTERFACE !== "")
        console.log('showSecondary set to:', config.SECONDARY_INTERFACE !== "")
        console.log('========================')
      } catch (error) {
        console.error('Error fetching network config:', error)
      }
    }

    fetchNetworkConfig()
  }, [])

  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 rounded-lg shadow-lg">
      <PingChart showSecondary={showSecondary} />
      <PingStats showSecondary={showSecondary} />
    </div>
  )
} 