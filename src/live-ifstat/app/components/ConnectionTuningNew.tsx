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
  PRIMARY_LABEL: string;
  SECONDARY_LABEL: string;
  CAKE_PARAMS: string;
  CAKE_DEFAULT: string;
  [key: string]: BandwidthValue | string;
}

export default function ConnectionTuningNew() {
  const [config, setConfig] = useState<TuningConfig | null>(null)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeConnection, setActiveConnection] = useState<string | null>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch('/api/network-config')
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status}`)
        }
        const data = await response.json()
        setConfig(data)
      } catch (error) {
        console.error('Failed to fetch config:', error)
        setError('Failed to load configuration')
      } finally {
        setMounted(true)
      }
    }

    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchConnectionStatus()
    const interval = setInterval(fetchConnectionStatus, 5000)
    return () => clearInterval(interval)
  }, [])

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
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: {
          ...(prev[key] as BandwidthValue),
          value
        }
      } as TuningConfig;
    });
  }

  const handleUnitChange = (key: string, unit: string) => {
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: {
          ...(prev[key] as BandwidthValue),
          unit
        }
      } as TuningConfig;
    });
  }

  const handleCakeParamsChange = (value: string) => {
    if (!config) return;
    
    try {
      setConfig(prev => {
        if (!prev) return null;
        return {
          ...prev,
          CAKE_PARAMS: value
        } as TuningConfig;
      });
    } catch (error) {
      console.error('Error updating CAKE params:', error);
      setError('Failed to update CAKE parameters');
    }
  }

  const handleLabelChange = (type: string, value: string) => {
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [`${type}_LABEL`]: value
      } as TuningConfig;
    });
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
      await fetchConnectionStatus()
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
      const response = await fetch('/api/switch-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      
      if (!response.ok) {
        throw new Error('Failed to switch gateway')
      }
      
      // Wait a moment for the switch to complete
      await new Promise(resolve => setTimeout(resolve, 2000))
      await fetchConnectionStatus()
    } catch (error) {
      console.error('Error switching gateway:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDefaultCakeParams = () => {
    if (!config?.CAKE_DEFAULT) {
      console.warn('No default CAKE parameters available');
      return;
    }
    
    try {
      setConfig(prev => {
        if (!prev) return null;
        return {
          ...prev,
          CAKE_PARAMS: prev.CAKE_DEFAULT
        } as TuningConfig;
      });
    } catch (error) {
      console.error('Error setting CAKE params:', error);
      setError('Failed to load default CAKE parameters');
    }
  }

  const renderConnectionSection = (type: 'PRIMARY' | 'SECONDARY') => {
    if (!config) return null;
    
    const isActive = activeConnection === type
    const ingressKey = `${type}_INGRESS_BANDWIDTH`
    const egressKey = `${type}_EGRESS_BANDWIDTH`
    const labelKey = `${type}_LABEL`

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
              className={`h-6 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'
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
                  type="text" 
                  value={(config[ingressKey] as BandwidthValue).value}
                  onChange={(e) => handleBandwidthChange(ingressKey, e.target.value)}
                  className="w-10 flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Value"
                />
                <select
                  value={(config[ingressKey] as BandwidthValue).unit}
                  onChange={(e) => handleUnitChange(ingressKey, e.target.value)}
                  className="w-12 px-1 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                  type="text"
                  value={(config[egressKey] as BandwidthValue).value}
                  onChange={(e) => handleBandwidthChange(egressKey, e.target.value)}
                  className="w-10 flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Value"
                />
                <select
                  value={(config[egressKey] as BandwidthValue).unit}
                  onChange={(e) => handleUnitChange(egressKey, e.target.value)}
                  className="w-12 px-1 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="mbit">Mbs</option>
                  <option value="gbit">Gbs</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-5">
                ISP
              </label>
              <input
                type="text"
                value={config[labelKey] as string || ''}
                onChange={(e) => handleLabelChange(type, e.target.value)}
                className="flex-1 px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder={`${type.charAt(0) + type.slice(1).toLowerCase()} Label`}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!mounted || !config) {
    return (
      <div className="p-3 h-full flex flex-col">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-label">Connection Tuning</h3>
          </div>
          <div className="text-center py-4 text-muted">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-label">Connection Tuning</h3>
          <button
            onClick={handleApply}
            disabled={loading}
            className="btn btn-green"
          >
            {loading ? 'Applying...' : 'Apply'}
          </button>
        </div>
        
        <div className="flex-1 grid grid-cols-2 gap-2">
          {renderConnectionSection('PRIMARY')}
          {renderConnectionSection('SECONDARY')}
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={config?.CAKE_PARAMS ?? ''}
              onChange={(e) => handleCakeParamsChange(e.target.value)}
              className="flex-1 px-2 py-1 text-small rounded-l bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="CAKE Parameters"
            />
            <button
              onClick={loadDefaultCakeParams}
              disabled={!config?.CAKE_DEFAULT}
              className="px-2 py-1 text-small bg-gray-100 dark:bg-gray-600 rounded-r border border-l-0 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
              title={config?.CAKE_DEFAULT || 'No default parameters available'}
            >
              Default
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 