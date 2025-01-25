'use client'

import { useState, useEffect } from 'react'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import { useRefresh } from '../contexts/RefreshContext'

interface DnsEntry {
  ip: string
  hostnames: string[]
}

export default function DnsHosts() {
  const [entries, setEntries] = useState<DnsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [newHostname, setNewHostname] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const { triggerRefresh, registerRefreshCallback } = useRefresh()

  const fetchEntries = async () => {
    try {
      const response = await fetch('/api/dns-hosts')
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setEntries(data.entries)
    } catch (error) {
      console.error('Error fetching DNS entries:', error)
      setError('Failed to load DNS entries')
    }
  }

  useEffect(() => {
    fetchEntries()
    return registerRefreshCallback(fetchEntries)
  }, [registerRefreshCallback])

  const handleSyncDNS = async () => {
    try {
      setIsSyncing(true)
      console.log('Starting DNS sync request...')
      
      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: {
          'Accept': 'text/plain'
        }
      })
      
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to sync DNS entries')
      }

      await fetchEntries()
      triggerRefresh()
    } catch (error) {
      console.error('Error in handleSyncDNS:', error)
      setError(error instanceof Error ? error.message : 'Failed to sync DNS entries')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIp || !newHostname) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dns-hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp, hostname: newHostname })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to add DNS entry')
        return
      }
      
      setNewIp('')
      setNewHostname('')
      setShowAdd(false)
      await fetchEntries()
      triggerRefresh()
    } catch (error) {
      console.error('Error adding DNS entry:', error)
      setError('Failed to add DNS entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (hostname: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dns-hosts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to delete DNS entry')
        return
      }
      
      await fetchEntries()
      triggerRefresh()
    } catch (error) {
      console.error('Error deleting DNS entry:', error)
      setError('Failed to delete DNS entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-800 rounded-lg p-2 shadow-sm transition-colors duration-200">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">DNS Hosts</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSyncDNS}
              disabled={isSyncing}
              className="h-6 px-2 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 transition-colors disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync DNS'}
            </button>
            <RefreshIcon 
              onClick={fetchEntries}
              className="w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25"
            />
            <AddIcon
              onClick={() => {
                setError(null)
                setShowAdd(true)
              }}
              className="w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25"
            />
          </div>
        </div>
        
        <div className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto">
            {showAdd && (
              <form onSubmit={handleAdd} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="IP Address"
                  className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  placeholder="Hostname"
                  className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
                <button
                  type="submit"
                  disabled={loading || !newIp || !newHostname}
                  className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckIcon fontSize="small" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false)
                    setError(null)
                  }}
                  className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <CloseIcon fontSize="small" />
                </button>
              </form>
            )}
            
            <div className="space-y-1 pr-2">
              {entries.map((entry) => (
                <div key={entry.ip} className="bg-white dark:bg-gray-700 rounded px-2 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-900 dark:text-gray-100">
                      {entry.ip}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.hostnames.map((hostname) => (
                      <div key={hostname} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-600 rounded px-1.5 py-0.5">
                        <span className="text-xs text-gray-700 dark:text-gray-300">{hostname}</span>
                        <button
                          onClick={() => handleDelete(hostname)}
                          disabled={loading}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 ml-1"
                        >
                          <CloseIcon style={{ fontSize: '14px' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 px-1">
            {error}
          </div>
        )}
      </div>
    </div>
  )
} 