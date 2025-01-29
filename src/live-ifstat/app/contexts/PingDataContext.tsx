'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface PingData {
  ping_delay_ms: number
  rolling_avg_ms: number
  packet_loss: boolean
  highest_ping: number
  lowest_ping: number
  samples: string
}

interface PingStatus {
  timestamp: string
  servers: {
    [key: string]: PingData
  }
}

interface NetworkConfig {
  // Add any necessary properties for network config
}

interface PingDataContextType {
  pingData: PingStatus | null
  error: string | null
  networkConfig: NetworkConfig | null
}

const PingDataContext = createContext<PingDataContextType>({
  pingData: null,
  error: null,
  networkConfig: null
})

export function usePingData() {
  return useContext(PingDataContext)
}

export function PingDataProvider({ children }: { children: ReactNode }) {
  const [pingData, setPingData] = useState<PingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(null)

  useEffect(() => {
    const fetchNetworkConfig = async () => {
      try {
        const response = await fetch('/api/network-config')
        const config = await response.json()
        setNetworkConfig(config)
      } catch (error) {
        console.error('Failed to fetch network config:', error)
      }
    }
    fetchNetworkConfig()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/ping-status')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        if (data.error) {
          setError(data.error)
        } else {
          setPingData(data)
        }
      } catch (err) {
        console.error('Failed to fetch ping data:', err)
        setError('Failed to fetch ping data')
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000) // Poll every 2 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <PingDataContext.Provider value={{ 
      pingData, 
      error,
      networkConfig,
    }}>
      {children}
    </PingDataContext.Provider>
  )
} 