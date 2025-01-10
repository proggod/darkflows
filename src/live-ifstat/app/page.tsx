'use client'

import { useEffect, useState } from 'react'
import { NetworkDataProvider } from './contexts/NetworkDataContext'
import { useEditMode } from './contexts/EditModeContext'
import SortableGrid from './components/SortableGrid'

interface NetworkDevice {
  name: string
  type?: 'primary' | 'secondary' | 'internal'
  label?: string
  egressBandwidth?: string
  ingressBandwidth?: string
}

export default function HomePage() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const { isEditMode } = useEditMode();

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
        <SortableGrid devices={devices} isEditMode={isEditMode} />
      </div>
    </NetworkDataProvider>
  )
}
