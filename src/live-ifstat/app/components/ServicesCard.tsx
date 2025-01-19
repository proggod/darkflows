'use client'

import { useState, useEffect } from 'react'
import { Select, MenuItem, Dialog, DialogTitle, DialogContent } from '@mui/material'

interface Service {
  name: string
  enabled: string
  running: boolean
}

interface TimeRange {
  label: string
  minutes: number
}

const TIME_RANGES: TimeRange[] = [
  { label: '5 minutes', minutes: 5 },
  { label: '10 minutes', minutes: 10 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '1 day', minutes: 1440 }
]

export default function ServicesCard() {
  const [services, setServices] = useState<Service[]>([])
  const [error, setError] = useState<string>('')
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
      const response = await fetch('/api/services')
      const data = await response.json()
      if (response.ok) {
        setServices(data)
      } else {
        setError(data.error || 'Failed to load services')
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      setError('Failed to load services')
    }
  }

  const fetchServiceStatus = async (serviceName: string) => {
    try {
      setStatusError('')
      const response = await fetch(`/api/services/${serviceName}`)
      const data = await response.json()
      if (response.ok) {
        setServiceStatus(data.status)
      } else {
        setStatusError(data.error || 'Failed to load service status')
      }
    } catch (error) {
      console.error('Error fetching service status:', error)
      setStatusError('Failed to load service status')
    }
  }

  const fetchServiceLogs = async (serviceName: string, minutes: number) => {
    try {
      setLogsError('')
      const response = await fetch(`/api/services/${serviceName}/logs?timeRange=${minutes}`)
      const data = await response.json()
      if (response.ok) {
        setLogs(data.logs)
      } else {
        setLogsError(data.error || 'Failed to load service logs')
      }
    } catch (error) {
      console.error('Error fetching service logs:', error)
      setLogsError('Failed to load service logs')
    }
  }

  const handleServiceClick = (serviceName: string) => {
    setSelectedService(serviceName)
    fetchServiceStatus(serviceName)
  }

  const handleShowLogs = (serviceName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedService(serviceName)
    setShowLogs(true)
    fetchServiceLogs(serviceName, timeRange)
  }

  const handleCloseModal = () => {
    setSelectedService(null)
    setServiceStatus('')
    setStatusError('')
    setShowLogs(false)
    setLogs('')
    setLogsError('')
  }

  const handleTimeRangeChange = (minutes: number) => {
    setTimeRange(minutes)
    if (selectedService) {
      fetchServiceLogs(selectedService, minutes)
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-[490px] flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Services</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {services.length} services
          </span>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
            size="small"
            className="h-6 text-[11px] bg-white dark:bg-gray-700"
            sx={{ 
              fontSize: '11px',
              '.MuiSelect-select': { 
                padding: '2px 24px 2px 6px',
                minHeight: '0px'
              }
            }}
          >
            <MenuItem value="all" sx={{ fontSize: '11px', minHeight: '20px', padding: '2px 6px' }}>All Services</MenuItem>
            <MenuItem value="enabled" sx={{ fontSize: '11px', minHeight: '20px', padding: '2px 6px' }}>Enabled Only</MenuItem>
            <MenuItem value="disabled" sx={{ fontSize: '11px', minHeight: '20px', padding: '2px 6px' }}>Disabled Only</MenuItem>
          </Select>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3 px-3">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Name</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">Enabled</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">Status</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-10">Logs</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {filteredServices.map((service) => (
              <tr key={service.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td 
                  className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => handleServiceClick(service.name)}
                >
                  {service.name}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  <span className={`px-1.5 py-0.5 rounded ${
                    service.enabled === 'enabled' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                    'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                  }`}>
                    {service.enabled}
                  </span>
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  <span className={`px-1.5 py-0.5 rounded ${
                    service.running ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                    'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                  }`}>
                    {service.running ? 'Running' : 'Stopped'}
                  </span>
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  <button
                    onClick={(e) => handleShowLogs(service.name, e)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="View Logs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog 
        open={!!selectedService && !showLogs} 
        onClose={handleCloseModal}
        maxWidth="md"
        PaperProps={{
          className: 'bg-white dark:bg-gray-800'
        }}
      >
        <DialogTitle className="text-gray-900 dark:text-gray-100 text-sm font-semibold border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span>Service Status: {selectedService}</span>
          <button
            onClick={handleCloseModal}
            className="text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-400 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </DialogTitle>
        <DialogContent>
          {statusError ? (
            <div className="text-red-600 dark:text-red-400 text-xs mt-2">{statusError}</div>
          ) : (
            <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap mt-2">
              {serviceStatus}
            </pre>
          )}
        </DialogContent>
      </Dialog>

      <Dialog 
        open={!!selectedService && showLogs} 
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          className: 'bg-white dark:bg-gray-800'
        }}
      >
        <DialogTitle className="text-gray-900 dark:text-gray-100 text-sm font-semibold border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span>Service Logs: {selectedService}</span>
            <div className="flex items-center gap-4">
              <Select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value as number)}
                size="small"
                className="h-6 text-[11px] bg-white dark:bg-gray-700"
                sx={{ 
                  fontSize: '11px',
                  '.MuiSelect-select': { 
                    padding: '2px 24px 2px 6px',
                    minHeight: '0px'
                  }
                }}
              >
                {TIME_RANGES.map(range => (
                  <MenuItem 
                    key={range.minutes} 
                    value={range.minutes}
                    sx={{ fontSize: '11px', minHeight: '20px', padding: '2px 6px' }}
                  >
                    {range.label}
                  </MenuItem>
                ))}
              </Select>
              <button
                onClick={handleCloseModal}
                className="text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-400 focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </DialogTitle>
        <DialogContent>
          {logsError ? (
            <div className="text-red-600 dark:text-red-400 text-xs mt-2">{logsError}</div>
          ) : (
            <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap mt-2 max-h-[60vh] overflow-auto">
              {logs}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 