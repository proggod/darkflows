'use client'

import { useState, useEffect } from 'react'

export default function RouteHostToSecondary() {
  const [ips, setIps] = useState<string[]>([])
  const [newIp, setNewIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIps()
  }, [])

  const fetchIps = async () => {
    try {
      const response = await fetch('/api/secondary-routes')
      if (!response.ok) {
        throw new Error('Failed to fetch routes')
      }
      const data = await response.json()
      setIps(data.ips)
    } catch (error) {
      console.error('Error fetching IPs:', error)
      setError('Failed to load routes')
    }
  }

  const handleDelete = async (ip: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/secondary-routes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to delete route')
        return
      }
      
      await fetchIps()
    } catch (error) {
      console.error('Error deleting IP:', error)
      setError('Failed to delete route')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIp) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/secondary-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to add route')
        return
      }
      
      setNewIp('')
      await fetchIps()
    } catch (error) {
      console.error('Error adding IP:', error)
      setError('Failed to add route')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 shadow-sm transition-colors duration-200 h-card">
      <div className="flex flex-col h-full">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Route Host to Secondary</h2>
        
        <div className="flex-1 overflow-auto">
          {ips.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">No routes configured</p>
          ) : (
            <div className="space-y-1">
              {ips.map((ip) => (
                <div key={ip} className="flex items-center justify-between bg-white dark:bg-gray-700 rounded px-2 py-1">
                  <span className="text-xs text-gray-900 dark:text-gray-100">{ip}</span>
                  <button
                    onClick={() => handleDelete(ip)}
                    disabled={loading}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
            <p className="text-[10px] text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleAdd} className="mt-2 flex gap-2">
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="Enter IP address"
            className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={loading || !newIp}
            className="px-3 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  )
} 