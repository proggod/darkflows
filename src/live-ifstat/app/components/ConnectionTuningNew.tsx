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

export default function ConnectionTuningNew() {
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
    fetchConfig()
    fetchConnectionStatus()
    const interval = setInterval(fetchConnectionStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/network-config')
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`)
      }
      const data = await response.json()
      setConfig(data)
    } catch (error) {
      console.error('Error fetching config:', error)
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
      console.error('Error fetching connection status:', error)
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
    setError(null)
    
    try {
      const response = await fetch('/api/network-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to apply changes: ${errorText}`)
      }
      
      await response.json()
      await fetchConfig()
    } catch (error) {
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
      console.error('Error switching gateway:', error)
    }
    setLoading(false)
  }

  const renderConnectionSection = (type: 'PRIMARY' | 'SECONDARY') => {
    const isActive = activeConnection === type
    const ingressKey = `${type}_INGRESS_BANDWIDTH`
    const egressKey = `${type}_EGRESS_BANDWIDTH`

    return (
      <div className="flex flex-col justify-between space-y-2 border border-gray-200 dark:border-gray-700 rounded p-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100">{type.charAt(0) + type.slice(1).toLowerCase()}</h3>
              {isActive && (
                <span className="px-1 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 rounded">
                  Active
                </span>
              )}
            </div>
            <button
              onClick={() => switchGateway(type)}
              disabled={loading || isActive}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                isActive
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              Switch
            </button>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-5">
                In
              </label>
              <div className="flex gap-1 flex-1">
                <input
                  type="number"
                  value={(config[ingressKey] as BandwidthValue).value}
                  onChange={(e) => handleBandwidthChange(ingressKey, e.target.value)}
                  className="flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Value"
                />
                <select
                  value={(config[ingressKey] as BandwidthValue).unit}
                  onChange={(e) => handleUnitChange(ingressKey, e.target.value)}
                  className="w-14 px-1 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="mbit">Mbs</option>
                  <option value="gbit">Gbs</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-5">
                Out
              </label>
              <div className="flex gap-1 flex-1">
                <input
                  type="number"
                  value={(config[egressKey] as BandwidthValue).value}
                  onChange={(e) => handleBandwidthChange(egressKey, e.target.value)}
                  className="flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Value"
                />
                <select
                  value={(config[egressKey] as BandwidthValue).unit}
                  onChange={(e) => handleUnitChange(egressKey, e.target.value)}
                  className="w-14 px-1 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="mbit">Mbs</option>
                  <option value="gbit">Gbs</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 shadow-sm transition-colors duration-200 h-card">
      <div className="flex flex-col h-full">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Connection Settings</h2>
        
        <div className="flex-1 grid grid-cols-2 gap-2">
          {renderConnectionSection('PRIMARY')}
          {renderConnectionSection('SECONDARY')}
        </div>

        {error && (
          <div className="mt-1.5 p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
            <p className="text-[10px] text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="mt-2 flex justify-center">
          <button
            onClick={handleApply}
            disabled={loading}
            className="w-full px-3 py-1.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-1 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  )
} 