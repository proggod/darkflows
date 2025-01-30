'use client'

import { useState, useEffect } from 'react'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import LaunchIcon from '@mui/icons-material/Launch'

type ListType = 'whitelist' | 'blacklist'

interface ListState {
  entries: string[]
  loading: boolean
  error: string | null
  showAdd: boolean
  newDomain: string
}

export default function PiholeLists() {
  const [whitelist, setWhitelist] = useState<ListState>({
    entries: [],
    loading: false,
    error: null,
    showAdd: false,
    newDomain: ''
  })
  const [blacklist, setBlacklist] = useState<ListState>({
    entries: [],
    loading: false,
    error: null,
    showAdd: false,
    newDomain: ''
  })

  const fetchList = async (type: ListType) => {
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    
    try {
      const response = await fetch(`/api/pihole-lists?type=${type}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setState(prev => ({ ...prev, entries: data.entries }))
    } catch (error) {
      console.error(`Error fetching ${type}:`, error)
      setState(prev => ({ ...prev, error: `Failed to load ${type}` }))
    }
  }

  useEffect(() => {
    fetchList('whitelist')
    fetchList('blacklist')
  }, [])

  const handleAdd = async (type: ListType) => {
    const state = type === 'whitelist' ? whitelist : blacklist
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    
    if (!state.newDomain) return

    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch('/api/pihole-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, domain: state.newDomain })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to add to ${type}`)
      }
      
      setState(prev => ({ ...prev, newDomain: '', showAdd: false }))
      await fetchList(type)
    } catch (error) {
      console.error(`Error adding to ${type}:`, error)
      setState(prev => ({ ...prev, error: `Failed to add to ${type}` }))
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const handleDelete = async (type: ListType, domain: string) => {
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch('/api/pihole-lists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, domain })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to remove from ${type}`)
      }
      
      await fetchList(type)
    } catch (error) {
      console.error(`Error removing from ${type}:`, error)
      setState(prev => ({ ...prev, error: `Failed to remove from ${type}` }))
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const renderList = (type: ListType) => {
    const state = type === 'whitelist' ? whitelist : blacklist
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    const title = type === 'whitelist' ? 'Whitelisted Domains' : 'Blacklisted Domains'

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</h3>
          <button
            onClick={() => setState(prev => ({ ...prev, showAdd: true, error: null }))}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Add
          </button>
        </div>
        
        {state.showAdd && (
          <form onSubmit={(e) => { e.preventDefault(); handleAdd(type); }} className="flex gap-2 mb-2">
            <input
              type="text"
              value={state.newDomain}
              onChange={(e) => setState(prev => ({ ...prev, newDomain: e.target.value }))}
              placeholder="Domain"
              className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={state.loading || !state.newDomain}
              className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckIcon fontSize="small" />
            </button>
            <button
              type="button"
              onClick={() => setState(prev => ({ ...prev, showAdd: false, error: null }))}
              className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <CloseIcon fontSize="small" />
            </button>
          </form>
        )}
        
        <div className="space-y-1">
          {state.entries.map((domain) => (
            <div key={domain} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
              <span className="text-xs text-gray-900 dark:text-gray-100">{domain}</span>
              <button
                onClick={() => handleDelete(type, domain)}
                disabled={state.loading}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {state.error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {state.error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Pi-hole Lists</h3>
          <button
            onClick={() => window.open(`${window.location.protocol}//${window.location.hostname}/admin`, '_blank')}
            className="btn btn-blue flex items-center gap-1"
          >
            <LaunchIcon className="!w-3 !h-3" />
            Pi-hole Admin
          </button>
        </div>
        
        <div className="flex-1 overflow-auto">
          <div className="h-full overflow-y-auto space-y-4">
            {renderList('whitelist')}
            {renderList('blacklist')}
          </div>
        </div>
      </div>
    </div>
  )
} 