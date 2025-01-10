'use client'

import { useEffect, useState } from 'react'
import DeviceChart from './components/DeviceChart'
import SysChart from './components/SysChart'
import ServerInfo from './components/ServerInfo'
import { NetworkDataProvider } from './contexts/NetworkDataContext'
import StatusBox from './components/StatusBox'

interface NetworkDevice {
  name: string
  type?: 'primary' | 'secondary' | 'internal'
  label?: string
  egressBandwidth?: string
  ingressBandwidth?: string
}

export default function HomePage() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices')
        const data = await response.json()
        console.log('Frontend received devices:', data.devices)
        // Sort devices: primary first, then secondary, then others alphabetically
        const reorderedDevices = data.devices.sort((a: NetworkDevice, b: NetworkDevice) => {
          if (a.type === 'primary') return -1
          if (b.type === 'primary') return 1
          if (a.type === 'secondary') return -1
          if (b.type === 'secondary') return 1
          return a.name.localeCompare(b.name)
        })
        console.log('Reordered devices:', reorderedDevices)
        setDevices(reorderedDevices)
      } catch (error) {
        console.error('Failed to fetch network devices:', error)
        setDevices([])
      }
    }

    fetchDevices()
  }, [])

  return (
    <NetworkDataProvider>
      <div className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-2xl font-bold mb-8 text-center text-gray-900">Network & System Metrics</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ServerInfo />
          <StatusBox />
        </div>

        <div 
          className="
            grid 
            grid-cols-1 
            md:grid-cols-1 
            lg:grid-cols-2 
            xl:grid-cols-3 
            2xl:grid-cols-3 
            gap-8
          "
        >
          {devices.map((device) => (
            <DeviceChart 
              key={device.name} 
              device={device.name}
              label={device.label}
              type={device.type}
              egressBandwidth={device.egressBandwidth}
              ingressBandwidth={device.ingressBandwidth}
            />
          ))}

          {/* CPU and Memory charts */}
          <SysChart metric="cpu" />
          <SysChart metric="mem" />
        </div>
      </div>
    </NetworkDataProvider>
  )
}
