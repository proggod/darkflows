'use client'

import { useState, useEffect } from 'react'

export default function RouteHostToSecondary() {
  const [ips, setIps] = useState<string[]>([])
  const [newIp, setNewIp] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIps()
  }, [])

  const fetchIps = async () => {
    try {
      setLoading(true)
      console.log('Fetching IPs...')
      const response = await fetch('/api/secondary-routes')
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Failed to fetch routes: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Fetched data:', data)
      
      if (!Array.isArray(data.routes)) {
        console.error('Invalid data format:', data)
        throw new Error('Invalid data format received')
      }
      
      setIps(data.routes)
    } catch (error) {
      console.error('Error fetching IPs:', error)
      setError(error instanceof Error ? error.message : 'Failed to load routes')
      setIps([])
    } finally {
      setLoading(false)
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
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="text-label mb-2">Route to Secondary</h3>
        
        {loading ? (
          <div className="text-center py-4 text-muted">Loading routes...</div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">IP Address</th>
                  <th className="px-2 py-1 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ips.map((ip, index) => (
                  <tr 
                    key={ip} 
                    className={`card-hover ${
                      index % 2 === 0 ? '' : 'card-alternate'
                    } ${index === ips.length - 1 ? 'last-row' : ''}`}
                  >
                    <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{ip}</td>
                    <td className="px-2 py-1 text-xs text-right">
                      <button
                        onClick={() => handleDelete(ip)}
                        disabled={loading}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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