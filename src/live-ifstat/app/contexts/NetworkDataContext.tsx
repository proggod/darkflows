'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'

interface IfstatData {
  timestamp: string
  kbIn: number
  kbOut: number
  device: string
}

interface NetworkData {
  [device: string]: IfstatData[]
}

interface NetworkDataContextType {
  data: NetworkData
  connectionStatus: 'connecting' | 'connected' | 'error'
  lastError: string | null
}

const NetworkDataContext = createContext<NetworkDataContextType>({
  data: {},
  connectionStatus: 'connecting',
  lastError: null
})

const MAX_DATA_POINTS = 60

export function NetworkDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<NetworkData>({})
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [lastError, setLastError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)


  // Reconnection strategy with backoff
  const connectEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setConnectionStatus('connecting')
    const url = '/api/ifstat-stream'
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setConnectionStatus('connected')
      setLastError(null)
      setRetryCount(0) // Reset retry count on successful connection
    }

    es.onmessage = (e) => {
      try {
        if (e.type === 'heartbeat') return

        const newData = JSON.parse(e.data) as IfstatData

        if (!newData.device || typeof newData.kbIn !== 'number' || typeof newData.kbOut !== 'number') {
          console.error('Invalid data format:', newData)
          return
        }

        setData(prev => {
          const deviceData = prev[newData.device] || []
          const updated = [...deviceData, newData]
          if (updated.length > MAX_DATA_POINTS) {
            updated.shift()
          }
          return { ...prev, [newData.device]: updated }
        })
      } catch (err) {
        const error = err as Error
        console.error('Error parsing SSE data:', error)
        setLastError(`Error parsing data: ${error.message}`)
      }
    }

    es.onerror = (err) => {
      console.error('Network stats SSE error:', err)
      setConnectionStatus('error')
      setLastError('Connection to network stats failed')
      
      // Close current connection
      es.close()
      
      // Implement exponential backoff for reconnection
      const maxRetryCount = 5
      if (retryCount < maxRetryCount) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000) // 1s, 2s, 4s, 8s, 16s, 30s max
        console.log(`Reconnecting in ${delay}ms (attempt ${retryCount + 1})`)
        
        setTimeout(() => {
          setRetryCount(prevCount => prevCount + 1)
          connectEventSource()
        }, delay)
      }
    }
  }, [retryCount])

  useEffect(() => {
    connectEventSource()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connectEventSource])

  return (
    <NetworkDataContext.Provider value={{ data, connectionStatus, lastError }}>
      {children}
    </NetworkDataContext.Provider>
  )
}

export function useNetworkData(device: string) {
  const context = useContext(NetworkDataContext)
  if (!context) {
    throw new Error('useNetworkData must be used within a NetworkDataProvider')
  }

  return {
    data: context.data[device] || [],
    connectionStatus: context.connectionStatus,
    lastError: context.lastError
  }
} 