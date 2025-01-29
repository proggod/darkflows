'use client'

import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [newHostname, setNewHostname] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const { triggerRefresh, registerRefreshCallback } = useRefresh()

  const fetchEntries = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dns-hosts')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      if (!Array.isArray(data.entries)) {
        throw new Error('Invalid data format received')
      }
      setEntries(data.entries)
      setError(null)
    } catch (error: unknown) {
      console.error('Error fetching DNS entries:', error)
      setError(error instanceof Error ? error.message : 'Failed to load DNS entries')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
    return registerRefreshCallback(fetchEntries)
  }, [registerRefreshCallback])

  const handleSyncDNS = async () => {
    try {
      setIsSyncing(true)
      setError(null)
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
    } catch (error: unknown) {
      console.error('Error in handleSyncDNS:', error)
      setError(error instanceof Error ? error.message : 'Failed to sync DNS entries')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIp || !newHostname) {
      setError('IP and hostname are required')
      return
    }

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
        throw new Error(data.error || 'Failed to add DNS entry')
      }
      
      setNewIp('')
      setNewHostname('')
      setShowAdd(false)
      await fetchEntries()
      triggerRefresh()
    } catch (error: unknown) {
      console.error('Error adding DNS entry:', error)
      setError(error instanceof Error ? error.message : 'Failed to add DNS entry')
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
        throw new Error(data.error || 'Failed to delete DNS entry')
      }
      
      await fetchEntries()
      triggerRefresh()
    } catch (error: unknown) {
      console.error('Error deleting DNS entry:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete DNS entry')
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
              disabled={isSyncing || loading}
              className="h-6 px-2 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 transition-colors disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync DNS'}
            </button>
            <RefreshIcon 
              onClick={fetchEntries}
              className={`w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25 ${loading ? 'opacity-50' : ''}`}
            />
            <AddIcon
              onClick={() => {
                setError(null)
                setShowAdd(true)
              }}
              className={`w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25 ${loading ? 'opacity-50' : ''}`}
            />
          </div>
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 px-1">
            {error}
          </div>
        )}

        {loading && entries.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400 p-4 text-center">
            Loading DNS entries...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400 p-4 text-center">
            No DNS entries found
          </div>
        ) : (
          <div className="overflow-auto flex-grow">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">
                    IP Address
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">
                    Hostnames
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.ip}-${index}`} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                    <td className="text-xs text-gray-900 dark:text-gray-100 py-2">
                      {entry.ip}
                    </td>
                    <td className="text-xs text-gray-900 dark:text-gray-100 py-2">
                      {entry.hostnames.join(', ')}
                    </td>
                    <td className="text-right">
                      {entry.hostnames.map(hostname => (
                        <button
                          key={hostname}
                          onClick={() => handleDelete(hostname)}
                          disabled={loading}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 ml-2"
                          title="Delete hostname"
                        >
                          <CloseIcon className="w-2 h-2" />
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleAdd} className="mt-4 space-y-2">
            <div>
              <input
                type="text"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                placeholder="IP Address"
                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                disabled={loading}
              />
            </div>
            <div>
              <input
                type="text"
                value={newHostname}
                onChange={(e) => setNewHostname(e.target.value)}
                placeholder="Hostname"
                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                disabled={loading}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false)
                  setNewIp('')
                  setNewHostname('')
                  setError(null)
                }}
                className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                disabled={loading || !newIp || !newHostname}
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
} 