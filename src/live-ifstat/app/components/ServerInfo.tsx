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
    return <div className="text-red-600">Error: {error}</div>
  }

  if (!info) {
    return <div className="text-gray-700">Loading server info...</div>
  }

  return (
    <div className="bg-white p-4 text-gray-900">
      <h2 className="text-lg font-semibold mb-4">Server Information</h2>
      <div className="mb-2"><strong>OS:</strong> {info.osName} {info.osVersion}</div>
      <div className="mb-2"><strong>CPU:</strong> {info.cpuModel} ({info.cpus} cores)</div>
      <div className="mb-2"><strong>Total Memory:</strong> {info.totalMemMB} MB</div>
      <h3 className="font-semibold mt-4 mb-2">Network Interfaces:</h3>
      <ul className="list-disc list-inside">
        {info.interfaces.map((iface) => (
          <li key={iface.name}>
            {iface.name} - {iface.speed || 'Unknown speed'}
          </li>
        ))}
      </ul>
    </div>
  )
}
