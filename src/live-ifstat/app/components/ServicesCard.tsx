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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">Services</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
          className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5"
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {error && (
        <div className="text-red-600 dark:text-red-400 mb-2 text-xs">
          Error: {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        {loading && services.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">Loading services...</div>
        ) : (
          <table className="w-full h-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-1 py-0.5 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[80px]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
              {filteredServices.map((service, index) => (
                <tr 
                  key={service.name}
                  onClick={() => handleServiceClick(service.name)}
                  className={`hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}
                >
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    {service.name}
                  </td>
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right">
                    <button
                      className={`h-6 px-2 py-0.5 rounded text-xs font-medium focus:outline-none focus:ring-1 transition-colors flex items-center gap-1 w-[72px] justify-center ${
                        service.enabled === 'enabled'
                          ? 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700 focus:ring-green-500 dark:focus:ring-green-400'
                          : 'bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 focus:ring-red-500 dark:focus:ring-red-400'
                      }`}
                    >
                      {service.enabled.toUpperCase()}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedService && (
        <div className="mt-4 border-t pt-4 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedService}
            </h3>
            <button
              onClick={handleShowLogs}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>

          {statusError ? (
            <div className="text-red-600 dark:text-red-400 text-xs mb-2">
              Error: {statusError}
            </div>
          ) : (
            serviceStatus && (
              <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
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
                  className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5"
                >
                  <option value="60">Last hour</option>
                  <option value="360">Last 6 hours</option>
                  <option value="1440">Last 24 hours</option>
                </select>
              </div>

              {logsError ? (
                <div className="text-red-600 dark:text-red-400 text-xs">
                  Error: {logsError}
                </div>
              ) : (
                logs && (
                  <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-96">
                    {logs}
                  </pre>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 