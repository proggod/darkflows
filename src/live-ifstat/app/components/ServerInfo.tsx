'use client'

import { useEffect, useState } from 'react'

interface NetworkInterface {
  name: string
  speed?: string
}

interface ServerInfoData {
  totalMemMB: number
  cpus: number
  cpuModel: string
  osName: string
  osVersion: string
  interfaces: NetworkInterface[]
}

export default function ServerInfo() {
  const [info, setInfo] = useState<ServerInfoData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/server-info')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setInfo(data)
        }
      })
      .catch(() => setError('Failed to load server info'))
  }, [])

  if (error) {
    return <div className="text-red-600 dark:text-red-400 p-4">Error: {error}</div>
  }

  if (!info) {
    return <div className="text-gray-700 dark:text-gray-300 p-4">Loading server info...</div>
  }

  return (
    <div className="p-4 text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-semibold mb-4">Server Information</h2>
      <div className="mb-2">
        <strong>OS:</strong> <span className="text-gray-700 dark:text-gray-300">{info.osName} {info.osVersion}</span>
      </div>
      <div className="mb-2">
        <strong>CPU:</strong> <span className="text-gray-700 dark:text-gray-300">{info.cpuModel} ({info.cpus} cores)</span>
      </div>
      <div className="mb-2">
        <strong>Total Memory:</strong> <span className="text-gray-700 dark:text-gray-300">{info.totalMemMB} MB</span>
      </div>
      <h3 className="font-semibold mt-4 mb-2">Network Interfaces:</h3>
      <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
        {info.interfaces.map((iface) => (
          <li key={iface.name}>
            {iface.name} - {iface.speed || 'Unknown speed'}
          </li>
        ))}
      </ul>
    </div>
  )
}
