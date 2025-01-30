'use client'

import { useState, useEffect } from 'react'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'

interface LocalForward {
  externalPort: number
  localPort?: number
}

interface ExternalForward {
  externalPort: number
  internalIp: string
  internalPort: number
}

export default function PortForwards() {
  const [localForwards, setLocalForwards] = useState<LocalForward[]>([])
  const [externalForwards, setExternalForwards] = useState<ExternalForward[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLocalAdd, setShowLocalAdd] = useState(false)
  const [showExternalAdd, setShowExternalAdd] = useState(false)
  const [newLocalForward, setNewLocalForward] = useState<LocalForward>({ externalPort: 0 })
  const [newExternalForward, setNewExternalForward] = useState<ExternalForward>({ externalPort: 0, internalIp: '', internalPort: 0 })

  useEffect(() => {
    fetchForwards()
  }, [])

  const fetchForwards = async () => {
    try {
      const response = await fetch('/api/port-forwards')
      if (!response.ok) {
        throw new Error('Failed to fetch forwards')
      }
      const data = await response.json()
      setLocalForwards(data.localForwards)
      setExternalForwards(data.externalForwards)
    } catch (error) {
      console.error('Error fetching forwards:', error)
      setError('Failed to load forwards')
    }
  }

  const isPortInUse = (port: number) => {
    return localForwards.some(f => f.externalPort === port) ||
           externalForwards.some(f => f.externalPort === port)
  }

  const handleDelete = async (type: 'local' | 'external', externalPort: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/port-forwards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, externalPort })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to delete forward')
        return
      }
      
      await fetchForwards()
    } catch (error) {
      console.error('Error deleting forward:', error)
      setError('Failed to delete forward')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLocal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLocalForward.externalPort) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/port-forwards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'local', forward: newLocalForward })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to add forward')
        return
      }
      
      setNewLocalForward({ externalPort: 0 })
      setShowLocalAdd(false)
      await fetchForwards()
    } catch (error) {
      console.error('Error adding forward:', error)
      setError('Failed to add forward')
    } finally {
      setLoading(false)
    }
  }

  const handleAddExternal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExternalForward.externalPort || !newExternalForward.internalIp || !newExternalForward.internalPort) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/port-forwards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'external', forward: newExternalForward })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to add forward')
        return
      }
      
      setNewExternalForward({ externalPort: 0, internalIp: '', internalPort: 0 })
      setShowExternalAdd(false)
      await fetchForwards()
    } catch (error) {
      console.error('Error adding forward:', error)
      setError('Failed to add forward')
    } finally {
      setLoading(false)
    }
  }

  const handlePortChange = (value: string): number => {
    const parsed = parseInt(value)
    if (isNaN(parsed)) return 0
    return Math.min(65535, Math.max(0, parsed))
  }

  const handleLocalPortChange = (value: string) => {
    const port = handlePortChange(value)
    if (port > 0 && isPortInUse(port)) {
      setError('Port already in use in local or external forwards')
    } else {
      setError(null)
    }
    setNewLocalForward({
      ...newLocalForward,
      externalPort: port
    })
  }

  const handleExternalPortChange = (value: string) => {
    const port = handlePortChange(value)
    if (port > 0 && isPortInUse(port)) {
      setError('Port already in use in local or external forwards')
    } else {
      setError(null)
    }
    setNewExternalForward({
      ...newExternalForward,
      externalPort: port
    })
  }

  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="text-label mb-2">Port Forwards</h3>
        
        <div className="flex-1 overflow-auto">
          <div className="space-y-4">
            {/* Local Forwards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">Local Forwards</h3>
                <button
                  onClick={() => {
                    setError(null)
                    setShowLocalAdd(true)
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Add
                </button>
              </div>
              
              {showLocalAdd && (
                <form onSubmit={handleAddLocal} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    maxLength={5}
                    value={newLocalForward.externalPort || ''}
                    onChange={(e) => handleLocalPortChange(e.target.value)}
                    placeholder="Port"
                    className="w-16 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    maxLength={5}
                    value={newLocalForward.localPort || ''}
                    onChange={(e) => setNewLocalForward({
                      ...newLocalForward,
                      localPort: handlePortChange(e.target.value)
                    })}
                    placeholder="Local"
                    className="w-16 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={loading || !newLocalForward.externalPort || isPortInUse(newLocalForward.externalPort)}
                    className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CheckIcon fontSize="small" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLocalAdd(false)
                      setError(null)
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    <CloseIcon fontSize="small" />
                  </button>
                </form>
              )}
              
              <div className="space-y-1">
                {localForwards.map((forward) => (
                  <div key={forward.externalPort} className="flex items-center justify-between bg-white dark:bg-gray-700 rounded px-2 py-1">
                    <span className="text-xs text-gray-900 dark:text-gray-100">
                      {forward.localPort && forward.localPort !== forward.externalPort
                        ? `${forward.externalPort} → ${forward.localPort}`
                        : forward.externalPort}
                    </span>
                    <button
                      onClick={() => handleDelete('local', forward.externalPort)}
                      disabled={loading}
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* External Forwards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">External Forwards</h3>
                <button
                  onClick={() => {
                    setError(null)
                    setShowExternalAdd(true)
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Add
                </button>
              </div>
              
              {showExternalAdd && (
                <form onSubmit={handleAddExternal} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    maxLength={5}
                    value={newExternalForward.externalPort || ''}
                    onChange={(e) => handleExternalPortChange(e.target.value)}
                    placeholder="Port"
                    className="w-16 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={newExternalForward.internalIp}
                    onChange={(e) => setNewExternalForward({
                      ...newExternalForward,
                      internalIp: e.target.value
                    })}
                    placeholder="Internal IP"
                    className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    maxLength={5}
                    value={newExternalForward.internalPort || ''}
                    onChange={(e) => setNewExternalForward({
                      ...newExternalForward,
                      internalPort: handlePortChange(e.target.value)
                    })}
                    placeholder="Port"
                    className="w-16 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={loading || !newExternalForward.externalPort || !newExternalForward.internalIp || !newExternalForward.internalPort || isPortInUse(newExternalForward.externalPort)}
                    className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CheckIcon fontSize="small" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExternalAdd(false)
                      setError(null)
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    <CloseIcon fontSize="small" />
                  </button>
                </form>
              )}
              
              <div className="space-y-1">
                {externalForwards.map((forward) => (
                  <div key={forward.externalPort} className="flex items-center justify-between bg-white dark:bg-gray-700 rounded px-2 py-1">
                    <span className="text-xs text-gray-900 dark:text-gray-100">
                      {`${forward.externalPort} → ${forward.internalIp}:${forward.internalPort}`}
                    </span>
                    <button
                      onClick={() => handleDelete('external', forward.externalPort)}
                      disabled={loading}
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-2 p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
            <p className="text-[10px] text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
} 