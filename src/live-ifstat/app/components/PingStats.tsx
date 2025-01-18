'use client'

import { useEffect, useState } from 'react'

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

export default function PingStats() {
  const [pingData, setPingData] = useState<PingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        console.error(err)
        setError('Failed to fetch ping data')
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return <div className="text-red-600 dark:text-red-400 p-4">Error: {error}</div>
  }

  if (!pingData) {
    return <div className="text-gray-700 dark:text-gray-300 p-4">Loading ping data...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {Object.entries(pingData.servers).map(([server, data]) => (
        <div key={server} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{server} Connection Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-300">Current Ping</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{data.ping_delay_ms}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-300">Rolling Average</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{data.rolling_avg_ms}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-300">Highest Ping</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{data.highest_ping}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-300">Lowest Ping</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{data.lowest_ping}ms</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-800 dark:text-gray-300">Packet Loss</p>
              <p className={`font-bold ${data.packet_loss ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {data.packet_loss ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 
