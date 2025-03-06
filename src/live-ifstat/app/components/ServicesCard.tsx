'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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
  const [selectedService] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<string>('')
  const [statusError, setStatusError] = useState<string>('')
  const [logs, setLogs] = useState<string>('')
  const [logsError, setLogsError] = useState<string>('')
  const [timeRange, setTimeRange] = useState<number>(1440)
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedServiceForLogs, setSelectedServiceForLogs] = useState<string | null>(null)
  const logsRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    fetchServices()
    // Refresh every 10 seconds
    const interval = setInterval(fetchServices, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedService) {
      fetchServiceStatus(selectedService)
    }
  }, [selectedService])

  // Add effect to scroll logs to bottom when they change
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

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
      const response = await fetch(`/api/services/${serviceName}/logs?timeRange=${timeRange}&limit=1000`)
      if (!response.ok) {
        if (response.status === 500) {
          const errorData = await response.json()
          if (errorData.error?.includes('maxBuffer')) {
            setLogsError('Log output is too large. Try reducing the time range or refreshing.')
          } else {
            setLogsError(errorData.error || 'Failed to load logs')
          }
        } else {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return
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
    setSelectedServiceForLogs(serviceName)
    setShowLogModal(true)
    await fetchServiceLogs(serviceName)
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

  const handleLogIconClick = async (e: React.MouseEvent, serviceName: string) => {
    e.stopPropagation()
    setSelectedServiceForLogs(serviceName)
    setShowLogModal(true)
    await fetchServiceLogs(serviceName)
  }

  const handleRefreshLogs = async () => {
    if (selectedServiceForLogs) {
      await fetchServiceLogs(selectedServiceForLogs)
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
    <div className="p-3 h-full flex flex-col overflow-hidden">
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

      <div className="flex-1 overflow-auto">
        {loading && services.length === 0 ? (
          <div className="text-center py-4 text-muted">Loading services...</div>
        ) : (
          <table className="w-full table-container">
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
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => handleLogIconClick(e, service.name)}
                        className="btn-icon btn-icon-blue"
                        title="View Logs"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </button>
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
                    </div>
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
            <h3 className="text-label">
              {selectedService}
            </h3>
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
        </div>
      )}

      {showLogModal && selectedServiceForLogs && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 99999 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-[80vw] max-w-4xl h-[80vh] flex flex-col" style={{ zIndex: 100000 }}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <div className="flex flex-col gap-2">
                <h3 className="text-label">Logs for {selectedServiceForLogs}</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={timeRange}
                    onChange={(e) => {
                      setTimeRange(Number(e.target.value))
                      if (selectedServiceForLogs) {
                        fetchServiceLogs(selectedServiceForLogs)
                      }
                    }}
                    className="input w-auto"
                  >
                    <option value="60">Last hour</option>
                    <option value="360">Last 6 hours</option>
                    <option value="1440">Last 24 hours</option>
                  </select>
                  {logsError?.includes('too large') && (
                    <span className="text-small text-red-500">Try reducing time range</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRefreshLogs}
                  className="btn-icon btn-icon-blue"
                  title="Refresh Logs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="btn-icon btn-icon-red"
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {logsError ? (
                <div className="text-red-600 dark:text-red-400 text-small">
                  Error: {logsError}
                </div>
              ) : (
                <pre 
                  ref={logsRef}
                  className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-small h-full overflow-y-auto"
                >
                  {logs}
                </pre>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
} 