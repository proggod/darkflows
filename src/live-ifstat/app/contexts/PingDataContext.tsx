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
  SECONDARY_INTERFACE: string;
  [key: string]: string;
}

interface PingDataContextType {
  pingData: PingStatus | null
  error: string | null
  networkConfig: NetworkConfig | null
  isLoading: boolean
}

const PingDataContext = createContext<PingDataContextType>({
  pingData: null,
  error: null,
  networkConfig: null,
  isLoading: true
})

export function usePingData() {
  return useContext(PingDataContext)
}

export function PingDataProvider({ children }: { children: ReactNode }) {
  const [pingData, setPingData] = useState<PingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchNetworkConfig = async () => {
      try {
        console.log("🚀 Starting network config fetch");
        
        // Use normal URL without cache-busting parameters
        const url = `/api/network-config`;
        console.log(`Fetching from: ${url}`);
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("✅ Network config success:", data);
          setNetworkConfig(data);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error("❌ Network config fetch failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNetworkConfig();
    const interval = setInterval(fetchNetworkConfig, 5000);
    return () => clearInterval(interval);
  }, []);

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
      isLoading
    }}>
      {children}
    </PingDataContext.Provider>
  )
} 