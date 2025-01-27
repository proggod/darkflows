'use client'

import { useState, useEffect } from 'react'

interface Service {
  name: string
  enabled: string
  running: boolean
}

export default function ServicesCard() {
  const [services, setServices] = useState<Service[]>([])
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<string>('')
  const [statusError, setStatusError] = useState<string>('')
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<string>('')
  const [logsError, setLogsError] = useState<string>('')
  const [timeRange, setTimeRange] = useState<number>(1440)

  useEffect(() => {
    fetchServices()
    // Refresh every 10 seconds
    const interval = setInterval(fetchServices, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/services')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      if (Array.isArray(data)) {
        setServices(data)
        setError('')
      } else {
        throw new Error('Invalid data format received')
      }
    } catch (error: unknown) {
      console.error('Error fetching services:', error)
      setError(error instanceof Error ? error.message : 'Failed to load services')
      setServices([]) // Clear services on error
    } finally {
      setLoading(false)
    }
  }

  const fetchServiceStatus = async (serviceName: string) => {
    try {
      setStatusError('')
      const response = await fetch(`/api/services/${serviceName}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      setServiceStatus(data.status || 'No status available')
    } catch (error: unknown) {
      console.error('Error fetching service status:', error)
      setStatusError(error instanceof Error ? error.message : 'Failed to load service status')
      setServiceStatus('')
    }
  }

  const fetchServiceLogs = async (serviceName: string) => {
    try {
      setLogsError('')
      const response = await fetch(`/api/services/${serviceName}/logs?timeRange=${timeRange}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      setLogs(data.logs || 'No logs available')
    } catch (error: unknown) {
      console.error('Error fetching service logs:', error)
      setLogsError(error instanceof Error ? error.message : 'Failed to load service logs')
      setLogs('')
    }
  }

  const handleServiceClick = async (serviceName: string) => {
    setSelectedService(serviceName)
    await fetchServiceStatus(serviceName)
    if (showLogs) {
      await fetchServiceLogs(serviceName)
    }
  }

  const handleShowLogs = async () => {
    setShowLogs(!showLogs)
    if (!showLogs && selectedService) {
      await fetchServiceLogs(selectedService)
    }
  }

  const filteredServices = services.filter(service => {
    switch (filter) {
      case 'enabled':
        return service.enabled === 'enabled'
      case 'disabled':
        return service.enabled === 'disabled'
      default:
        return true
    }
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Services</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
          className="text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {error && (
        <div className="text-red-600 dark:text-red-400 mb-4 text-sm">
          Error: {error}
        </div>
      )}

      {loading && services.length === 0 ? (
        <div className="text-gray-600 dark:text-gray-400 text-sm">Loading services...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {filteredServices.map(service => (
              <div
                key={service.name}
                onClick={() => handleServiceClick(service.name)}
                className={`p-2 rounded cursor-pointer ${
                  selectedService === service.name
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-900 dark:text-gray-100">{service.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      service.enabled === 'enabled'
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {service.enabled}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {selectedService && (
            <div className="mt-4 border-t pt-4 dark:border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-medium text-gray-900 dark:text-gray-100">
                  {selectedService}
                </h3>
                <button
                  onClick={handleShowLogs}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {showLogs ? 'Hide Logs' : 'Show Logs'}
                </button>
              </div>

              {statusError ? (
                <div className="text-red-600 dark:text-red-400 text-sm mb-2">
                  Error: {statusError}
                </div>
              ) : (
                serviceStatus && (
                  <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-sm overflow-x-auto">
                    {serviceStatus}
                  </pre>
                )
              )}

              {showLogs && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Logs</h4>
                    <select
                      value={timeRange}
                      onChange={(e) => {
                        setTimeRange(Number(e.target.value))
                        if (selectedService) {
                          fetchServiceLogs(selectedService)
                        }
                      }}
                      className="text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                    >
                      <option value="60">Last hour</option>
                      <option value="360">Last 6 hours</option>
                      <option value="1440">Last 24 hours</option>
                    </select>
                  </div>

                  {logsError ? (
                    <div className="text-red-600 dark:text-red-400 text-sm">
                      Error: {logsError}
                    </div>
                  ) : (
                    logs && (
                      <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-sm overflow-x-auto max-h-96">
                        {logs}
                      </pre>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 