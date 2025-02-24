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

    const es = new EventSource(url)

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
      // Get more detailed error information
      const errorDetails = {
        readyState: es.readyState,
        timestamp: new Date().toISOString(),
        type: err.type,
        // Add any additional error properties that might be available
        ...(err instanceof ErrorEvent ? {
          message: err.message,
          filename: err.filename,
          lineno: err.lineno,
          colno: err.colno,
        } : {})
      }

      console.error('Shared SSE error:', errorDetails)
      setConnectionStatus('error')
      
      // Provide more specific error message based on readyState
      const errorMessage = es.readyState === EventSource.CLOSED 
        ? 'Connection closed unexpectedly'
        : es.readyState === EventSource.CONNECTING 
          ? 'Connection attempt failed'
          : 'Connection error occurred'
        
      setLastError(errorMessage)
      
      // Attempt to reconnect after a delay if connection is closed
      if (es.readyState === EventSource.CLOSED) {
        setTimeout(() => {
          console.log('Attempting to reconnect...')
          es.close()
          // The browser will automatically attempt to reconnect
        }, 5000)
      }
    }

    return () => {
      console.log('Cleaning up SSE connection')
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