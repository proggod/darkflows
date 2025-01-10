'use client'

import { useState, useEffect } from 'react'

interface BandwidthValue {
  value: string;
  unit: string;
}

interface TuningConfig {
  PRIMARY_EGRESS_BANDWIDTH: BandwidthValue;
  PRIMARY_INGRESS_BANDWIDTH: BandwidthValue;
  SECONDARY_EGRESS_BANDWIDTH: BandwidthValue;
  SECONDARY_INGRESS_BANDWIDTH: BandwidthValue;
  [key: string]: BandwidthValue | string;
}

export default function ConnectionTuning() {
  const [config, setConfig] = useState<TuningConfig>({
    PRIMARY_EGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
    PRIMARY_INGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
    SECONDARY_EGRESS_BANDWIDTH: { value: '', unit: 'mbit' },
    SECONDARY_INGRESS_BANDWIDTH: { value: '', unit: 'mbit' }
  })
  const [loading, setLoading] = useState(false)
  const [activeConnection, setActiveConnection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('ConnectionTuning component mounted')
    fetchConfig()
    fetchConnectionStatus()
    // Poll connection status every 5 seconds
    const interval = setInterval(fetchConnectionStatus, 5000)
    return () => {
      console.log('ConnectionTuning component unmounting')
      clearInterval(interval)
    }
  }, [])

  const fetchConfig = async () => {
    console.log('Starting fetchConfig...')
    try {
      console.log('Sending GET request to /api/network-config')
      const response = await fetch('/api/network-config')
      console.log('Received response:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error fetching config:', errorText)
        throw new Error(`Failed to fetch config: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Received config data:', data)
      
      // Validate the received data
      if (!data.PRIMARY_EGRESS_BANDWIDTH || !data.PRIMARY_INGRESS_BANDWIDTH) {
        console.warn('Received incomplete config data:', data)
      }
      
      setConfig(data)
      console.log('Config state updated')
    } catch (error) {
      console.error('Error in fetchConfig:', error)
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
      }
    }
  }

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch('/api/connection-status')
      const data = await response.json()
      if (data.active) {
        setActiveConnection(data.active)
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error)
    }
  }

  const handleBandwidthChange = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: {
        ...((prev[key] as BandwidthValue) || { unit: 'mbit' }),
        value: value
      }
    }))
  }

  const handleUnitChange = (key: string, unit: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: {
        ...((prev[key] as BandwidthValue) || { value: '' }),
        unit: unit
      }
    }))
  }

  const handleApply = async () => {
    setLoading(true)
    setError(null) // Clear any previous errors
    
    try {
      // First, verify the config state
      console.log('Raw config state:', config)
      
      // Try stringifying in a separate step to catch any serialization issues
      let configJson
      try {
        configJson = JSON.stringify(config)
        console.log('Serialized config:', configJson)
      } catch (serializeError) {
        setError('Failed to process configuration data')
        throw serializeError
      }
      
      // Create the request in steps to debug any request setup issues
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: configJson
      }
      
      const response = await fetch('/api/network-config', requestOptions)
      
      if (!response.ok) {
        const errorText = await response.text()
        setError(`Failed to apply changes: ${errorText}`)
        throw new Error(`Server returned ${response.status}: ${errorText}`)
      }
      
      await response.json() // Consume the response but don't store it
      await fetchConfig()
      
    } catch (error) {
      console.error('Error in handleApply:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  const switchGateway = async (type: 'PRIMARY' | 'SECONDARY') => {
    setLoading(true)
    try {
      await fetch('/api/switch-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
    } catch (error) {
      console.error('Failed to switch gateway:', error)
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Connection Tuning</h2>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Primary Connection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-gray-900">Primary</h3>
            {activeConnection === 'PRIMARY' && (
              <span className="text-sm font-medium text-green-600">active</span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Incoming Bandwidth</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={(config.PRIMARY_INGRESS_BANDWIDTH as BandwidthValue).value}
                onChange={(e) => handleBandwidthChange('PRIMARY_INGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              />
              <select
                value={(config.PRIMARY_INGRESS_BANDWIDTH as BandwidthValue).unit}
                onChange={(e) => handleUnitChange('PRIMARY_INGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              >
                <option value="mbit">Mbit</option>
                <option value="gbit">Gbit</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Outgoing Bandwidth</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={(config.PRIMARY_EGRESS_BANDWIDTH as BandwidthValue).value}
                onChange={(e) => handleBandwidthChange('PRIMARY_EGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              />
              <select
                value={(config.PRIMARY_EGRESS_BANDWIDTH as BandwidthValue).unit}
                onChange={(e) => handleUnitChange('PRIMARY_EGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              >
                <option value="mbit">Mbit</option>
                <option value="gbit">Gbit</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => switchGateway('PRIMARY')}
            disabled={loading}
            className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Switch to Primary
          </button>
        </div>

        {/* Secondary Connection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-gray-900">Secondary</h3>
            {activeConnection === 'SECONDARY' && (
              <span className="text-sm font-medium text-green-600">active</span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Incoming Bandwidth</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={(config.SECONDARY_INGRESS_BANDWIDTH as BandwidthValue).value}
                onChange={(e) => handleBandwidthChange('SECONDARY_INGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              />
              <select
                value={(config.SECONDARY_INGRESS_BANDWIDTH as BandwidthValue).unit}
                onChange={(e) => handleUnitChange('SECONDARY_INGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              >
                <option value="mbit">Mbit</option>
                <option value="gbit">Gbit</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Outgoing Bandwidth</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={(config.SECONDARY_EGRESS_BANDWIDTH as BandwidthValue).value}
                onChange={(e) => handleBandwidthChange('SECONDARY_EGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              />
              <select
                value={(config.SECONDARY_EGRESS_BANDWIDTH as BandwidthValue).unit}
                onChange={(e) => handleUnitChange('SECONDARY_EGRESS_BANDWIDTH', e.target.value)}
                className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              >
                <option value="mbit">Mbit</option>
                <option value="gbit">Gbit</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => switchGateway('SECONDARY')}
            disabled={loading}
            className="w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Switch to Secondary
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-center items-center gap-4">
          {loading && (
            <span className="text-sm text-gray-600">
              Applying changes...
            </span>
          )}
          <button
            onClick={handleApply}
            disabled={loading}
            className="w-64 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600 text-center">
            Error: {error}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-900">
        <p>Note: Please run a speed test at{' '}
          <a 
            href="https://www.waveform.com/tools/bufferbloat" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Waveform Bufferbloat Test
          </a>
          {' '}and set bandwidth to 85% of results.
        </p>
      </div>
    </div>
  )
} 