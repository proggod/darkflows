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

  const handleServiceAction = async (serviceName: string, action: string) => {
    try {
      const response = await fetch(`/api/services/${serviceName}/${action}`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      fetchServices()
    } catch (error: unknown) {
      console.error(`Error ${action}ing service:`, error)
      setError(error instanceof Error ? error.message : `Failed to ${action} service`)
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
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-label">Services</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
          className="input w-auto"
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {error && (
        <div className="text-red-600 dark:text-red-400 mb-2 text-small">
          Error: {error}
        </div>
      )}

      {loading && services.length === 0 ? (
        <div className="text-center py-4 text-muted">Loading services...</div>
      ) : (
        <table className="w-full h-full table-container">
          <thead className="sticky top-0 z-10">
            <tr className="table-header">
              <th className="card-hover">Name</th>
              <th className="w-[80px] card-hover text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map((service, index) => (
              <tr 
                key={service.name}
                onClick={() => handleServiceClick(service.name)}
                className={`card-hover ${
                  index % 2 === 0 ? '' : 'card-alternate'
                } ${index === filteredServices.length - 1 ? 'last-row' : ''}`}
              >
                <td className="px-1 whitespace-nowrap text-small leading-3">
                  {service.name}
                </td>
                <td className="px-1 whitespace-nowrap text-small leading-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleServiceAction(service.name, service.running ? 'stop' : 'start')
                    }}
                    className={`btn-icon ${service.running ? 'btn-icon-red' : 'btn-icon-green'}`}
                    title={service.running ? 'Stop' : 'Start'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d={service.running ? "M18 6L6 18M6 6l12 12" : "M5 12h14M12 5v14"} />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedService && (
        <div className="mt-4 border-t pt-4 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-label">
              {selectedService}
            </h3>
            <button
              onClick={handleShowLogs}
              className="btn-icon btn-icon-blue"
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>

          {statusError ? (
            <div className="text-red-600 dark:text-red-400 text-small mb-2">
              Error: {statusError}
            </div>
          ) : (
            serviceStatus && (
              <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-small overflow-x-auto whitespace-pre-wrap">
                {serviceStatus}
              </pre>
            )
          )}

          {showLogs && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-label">Logs</h4>
                <select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(Number(e.target.value))
                    if (selectedService) {
                      fetchServiceLogs(selectedService)
                    }
                  }}
                  className="input w-auto"
                >
                  <option value="60">Last hour</option>
                  <option value="360">Last 6 hours</option>
                  <option value="1440">Last 24 hours</option>
                </select>
              </div>

              {logsError ? (
                <div className="text-red-600 dark:text-red-400 text-small">
                  Error: {logsError}
                </div>
              ) : (
                logs && (
                  <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-small overflow-x-auto whitespace-pre-wrap max-h-96">
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