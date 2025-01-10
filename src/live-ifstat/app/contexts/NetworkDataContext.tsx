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
    console.log('Creating shared EventSource connection to:', url)
    setConnectionStatus('connecting')

    const es = new EventSource(url)

    es.onopen = () => {
      console.log('Shared EventSource connection opened')
      setConnectionStatus('connected')
      setLastError(null)
    }

    es.onmessage = (e) => {
      try {
        // Ignore heartbeat messages
        if (e.type === 'heartbeat') {
          console.log('Received heartbeat')
          return
        }

        console.log('Received message:', e.data)
        const newData = JSON.parse(e.data) as IfstatData
        console.log('Parsed data:', newData)

        if (!newData.device || typeof newData.kbIn !== 'number' || typeof newData.kbOut !== 'number') {
          console.error('Invalid data format:', newData)
          return
        }

        const device = newData.device

        setData(prev => {
          console.log('Current data for', device, ':', prev[device]?.length || 0, 'points')
          const deviceData = prev[device] || []
          const updated = [...deviceData, newData]
          if (updated.length > MAX_DATA_POINTS) {
            updated.shift()
          }
          console.log('Updated data for', device, ':', updated.length, 'points')
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
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect...')
        if (es.readyState === EventSource.CLOSED) {
          window.location.reload()
        }
      }, 5000)
    }

    return () => {
      console.log('Cleaning up shared EventSource connection')
      es.close()
    }
  }, [])

  // Debug output whenever data changes
  useEffect(() => {
    console.log('Network data updated:', Object.keys(data).map(device => ({
      device,
      points: data[device].length
    })))
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
  console.log(`[${device}] Requesting data:`, {
    available: context.data[device]?.length || 0,
    status: context.connectionStatus,
    error: context.lastError
  })

  return {
    data: context.data[device] || [],
    connectionStatus: context.connectionStatus,
    lastError: context.lastError
  }
} 