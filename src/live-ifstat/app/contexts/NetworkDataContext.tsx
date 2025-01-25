'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

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

  useEffect(() => {
    const url = '/api/ifstat-stream'
    setConnectionStatus('connecting')

    let es = new EventSource(url)

    es.onopen = () => {
      setConnectionStatus('connected')
      setLastError(null)
    }

    es.onmessage = (e) => {
      try {
        // Ignore heartbeat messages
        if (e.type === 'heartbeat') {
          return
        }

        const newData = JSON.parse(e.data) as IfstatData

        if (!newData.device || typeof newData.kbIn !== 'number' || typeof newData.kbOut !== 'number') {
          console.error('Invalid data format:', newData)
          return
        }

        const device = newData.device

        setData(prev => {
          const deviceData = prev[device] || []
          const updated = [...deviceData, newData]
          if (updated.length > MAX_DATA_POINTS) {
            updated.shift()
          }
          return {
            ...prev,
            [device]: updated
          }
        })
      } catch (err) {
        const error = err as Error
        console.error('Error parsing SSE data:', error)
        setLastError(`Error parsing data: ${error.message}`)
      }
    }

    es.onerror = (err) => {
      console.error('Shared SSE error:', err)
      setConnectionStatus('error')
      setLastError('Connection error occurred')
      
      // Try to reconnect after a delay without reloading the page
      setTimeout(() => {
        if (es.readyState === EventSource.CLOSED) {
          es.close()
          const newEs = new EventSource(url)
          es = newEs
          
          newEs.onopen = () => {
            setConnectionStatus('connected')
            setLastError(null)
          }
          
          newEs.onmessage = es.onmessage
          newEs.onerror = es.onerror
        }
      }, 5000)
    }

    return () => {
      es.close()
    }
  }, [])

  // Debug output whenever data changes
  useEffect(() => {
  }, [data])

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

  // Debug output whenever component requests data


  return {
    data: context.data[device] || [],
    connectionStatus: context.connectionStatus,
    lastError: context.lastError
  }
} 