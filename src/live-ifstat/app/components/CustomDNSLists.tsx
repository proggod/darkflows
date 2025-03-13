'use client'

import { useState, useEffect } from 'react'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import SyncIcon from '@mui/icons-material/Sync'
import LanguageIcon from '@mui/icons-material/Language'
import { VLANConfig } from '@/types/dashboard'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

type ListType = 'whitelist' | 'blacklist'

interface ListState {
  entries: string[]
  loading: boolean
  error: string | null
  showAdd: boolean
  newDomain: string
}

interface BlockList {
  name: string
  url: string
}

interface BlockListState {
  entries: BlockList[]
  loading: boolean
  error: string | null
  showAdd: boolean
  newName: string
  newUrl: string
  nameError: string | null
}

interface UpdatedEntry {
  vlanId: string
  name: string
  url: string
}

// Helper to validate blocklist name (only letters and numbers, no spaces)
function isValidBlocklistName(name: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(name)
}

export default function CustomDNSLists() {
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
  const [blocklists, setBlocklists] = useState<BlockListState>({
    entries: [],
    loading: false,
    error: null,
    showAdd: false,
    newName: '',
    newUrl: '',
    nameError: null
  })
  const [vlans, setVlans] = useState<VLANConfig[]>([])
  const [selectedVlanId, setSelectedVlanId] = useState<string>('default')
  const [loadingVlans, setLoadingVlans] = useState<boolean>(false)
  const [verifying, setVerifying] = useState<boolean>(false)
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false)
  const [snackbarMessage, setSnackbarMessage] = useState<string>('')
  const [updatedEntries, setUpdatedEntries] = useState<UpdatedEntry[]>([])

  const fetchVlans = async () => {
    setLoadingVlans(true)
    try {
      const response = await fetch('/api/vlans')
      if (!response.ok) throw new Error('Failed to fetch VLANs')
      const data = await response.json()
      setVlans(data)
    } catch (error) {
      console.error('Error fetching VLANs:', error)
    } finally {
      setLoadingVlans(false)
    }
  }

  const fetchList = async (type: ListType) => {
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    
    try {
      const response = await fetch(`/api/dns-lists?type=${type}&vlanId=${selectedVlanId}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setState(prev => ({ ...prev, entries: data.entries }))
    } catch (error) {
      console.error(`Error fetching ${type}:`, error)
      setState(prev => ({ ...prev, error: `Failed to load ${type}` }))
    }
  }

  const fetchBlocklists = async () => {
    setBlocklists(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/block-lists?vlanId=${selectedVlanId}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setBlocklists(prev => ({ ...prev, entries: data.entries, loading: false }))
    } catch (error) {
      console.error('Error fetching blocklists:', error)
      setBlocklists(prev => ({ 
        ...prev, 
        error: 'Failed to load blocklists',
        loading: false
      }))
    }
  }

  const verifyBlocklists = async () => {
    setVerifying(true)
    setUpdatedEntries([])
    try {
      const response = await fetch('/api/verify-blocklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vlanId: selectedVlanId })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify blocklists')
      }
      
      setSnackbarMessage('Blocklists verified and applied successfully')
      setSnackbarOpen(true)
      
      if (data.updatedEntries && data.updatedEntries.length > 0) {
        setUpdatedEntries(data.updatedEntries)
      }
      
      // Refresh the blocklists after verification
      await fetchBlocklists()
    } catch (error) {
      console.error('Error verifying blocklists:', error)
      setSnackbarMessage('Failed to verify blocklists')
      setSnackbarOpen(true)
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    fetchVlans()
  }, [])

  useEffect(() => {
    fetchList('whitelist')
    fetchList('blacklist')
    fetchBlocklists()
  }, [selectedVlanId])

  const handleAdd = async (type: ListType) => {
    const state = type === 'whitelist' ? whitelist : blacklist
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    
    if (!state.newDomain) return

    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch('/api/dns-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, domain: state.newDomain, vlanId: selectedVlanId })
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

  const handleBlocklistNameChange = (name: string) => {
    let nameError: string | null = null
    
    if (name && !isValidBlocklistName(name)) {
      nameError = 'Name must contain only letters and numbers (no spaces or special characters)'
    }
    
    setBlocklists(prev => ({ 
      ...prev, 
      newName: name,
      nameError
    }))
  }

  const handleAddBlocklist = async () => {
    if (!blocklists.newName || !blocklists.newUrl) return
    
    if (!isValidBlocklistName(blocklists.newName)) {
      setBlocklists(prev => ({ 
        ...prev, 
        nameError: 'Name must contain only letters and numbers (no spaces or special characters)'
      }))
      return
    }

    setBlocklists(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch('/api/block-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: blocklists.newName, 
          url: blocklists.newUrl, 
          vlanId: selectedVlanId 
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add blocklist')
      }
      
      setBlocklists(prev => ({ 
        ...prev, 
        newName: '', 
        newUrl: '', 
        showAdd: false,
        nameError: null
      }))
      await fetchBlocklists()
    } catch (error) {
      console.error('Error adding blocklist:', error)
      setBlocklists(prev => ({ ...prev, error: 'Failed to add blocklist' }))
    } finally {
      setBlocklists(prev => ({ ...prev, loading: false }))
    }
  }

  const handleDelete = async (type: ListType, domain: string) => {
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch('/api/dns-lists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, domain, vlanId: selectedVlanId })
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

  const handleDeleteBlocklist = async (name: string) => {
    setBlocklists(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch('/api/block-lists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, vlanId: selectedVlanId })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove blocklist')
      }
      
      await fetchBlocklists()
    } catch (error) {
      console.error('Error removing blocklist:', error)
      setBlocklists(prev => ({ ...prev, error: 'Failed to remove blocklist' }))
    } finally {
      setBlocklists(prev => ({ ...prev, loading: false }))
    }
  }

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false)
  }

  const renderList = (type: ListType) => {
    const state = type === 'whitelist' ? whitelist : blacklist
    const setState = type === 'whitelist' ? setWhitelist : setBlacklist
    const title = type === 'whitelist' ? 'Whitelisted Domains' : 'Blacklisted Domains'

    return (
      <div className={verifying ? 'opacity-50 pointer-events-none' : ''}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</h3>
          <button
            onClick={() => setState(prev => ({ ...prev, showAdd: true, error: null }))}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            disabled={verifying}
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
              disabled={verifying}
            />
            <button
              type="submit"
              disabled={state.loading || !state.newDomain || verifying}
              className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckIcon fontSize="small" />
            </button>
            <button
              type="button"
              onClick={() => setState(prev => ({ ...prev, showAdd: false, error: null }))}
              className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              disabled={verifying}
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
                disabled={state.loading || verifying}
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

  const renderBlocklists = () => {
    return (
      <div className={verifying ? 'opacity-50 pointer-events-none' : ''}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">Block Lists</h3>
          <div className="flex items-center gap-2">
            <a 
              href="https://oisd.nl/setup/unbound" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              title="OISD Unbound Setup"
            >
              <LanguageIcon sx={{ fontSize: '1rem' }} />
            </a>
            <button
              onClick={() => setBlocklists(prev => ({ ...prev, showAdd: true, error: null, nameError: null }))}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              disabled={verifying}
            >
              Add
            </button>
          </div>
        </div>
        
        {blocklists.showAdd && (
          <form onSubmit={(e) => { e.preventDefault(); handleAddBlocklist(); }} className="flex flex-col gap-2 mb-2">
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={blocklists.newName}
                onChange={(e) => handleBlocklistNameChange(e.target.value)}
                placeholder="Name (letters and numbers only, no spaces)"
                className={`flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border ${
                  blocklists.nameError 
                    ? 'border-red-500 dark:border-red-400' 
                    : 'border-gray-300 dark:border-gray-600'
                } text-gray-900 dark:text-gray-100`}
                disabled={verifying}
              />
              {blocklists.nameError && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {blocklists.nameError}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={blocklists.newUrl}
                onChange={(e) => setBlocklists(prev => ({ ...prev, newUrl: e.target.value }))}
                placeholder="URL"
                className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                disabled={verifying}
              />
              <button
                type="submit"
                disabled={
                  blocklists.loading || 
                  !blocklists.newName || 
                  !blocklists.newUrl || 
                  !!blocklists.nameError ||
                  verifying
                }
                className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckIcon fontSize="small" />
              </button>
              <button
                type="button"
                onClick={() => setBlocklists(prev => ({ 
                  ...prev, 
                  showAdd: false, 
                  error: null,
                  nameError: null
                }))}
                className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                disabled={verifying}
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
          </form>
        )}
        
        <div className="space-y-1">
          {blocklists.entries.map((blocklist) => (
            <div 
              key={blocklist.name} 
              className={`flex flex-col bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 ${
                updatedEntries.some(entry => entry.name === blocklist.name) 
                  ? 'border-l-4 border-green-500 dark:border-green-400' 
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{blocklist.name}</span>
                <button
                  onClick={() => handleDeleteBlocklist(blocklist.name)}
                  disabled={blocklists.loading || verifying}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{blocklist.url}</span>
              {updatedEntries.some(entry => entry.name === blocklist.name) && (
                <span className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Updated successfully
                </span>
              )}
            </div>
          ))}
        </div>

        {blocklists.error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {blocklists.error}
          </div>
        )}
      </div>
    )
  }

  // Custom styles for MUI components to match the title font
  const selectStyles = {
    fontSize: '0.875rem', // text-sm
    fontWeight: 500, // font-medium
    color: 'inherit',
    '.MuiSelect-select': {
      paddingTop: '0.25rem',
      paddingBottom: '0.25rem',
    }
  }

  const menuItemStyles = {
    fontSize: '0.875rem', // text-sm
    fontWeight: 500, // font-medium
  }

  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">DNS Custom Blocklists</h3>
          <div className="flex items-center gap-2">
            <Tooltip title="Apply Changes" arrow>
              <button
                onClick={verifyBlocklists}
                disabled={verifying || loadingVlans}
                className="w-6 h-6 flex items-center justify-center bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50"
              >
                {verifying ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SyncIcon sx={{ fontSize: '1rem' }} />
                )}
              </button>
            </Tooltip>
            <FormControl size="small" className="min-w-[120px]">
              <Select
                value={selectedVlanId}
                onChange={(e) => setSelectedVlanId(e.target.value)}
                className="text-gray-700 dark:text-gray-200"
                disabled={loadingVlans || verifying}
                sx={selectStyles}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      '& .MuiMenuItem-root': menuItemStyles
                    }
                  }
                }}
              >
                <MenuItem value="default" sx={menuItemStyles}>Default</MenuItem>
                {vlans.map((vlan) => (
                  <MenuItem key={vlan.id} value={vlan.id.toString()} sx={menuItemStyles}>
                    {vlan.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <div className="h-full overflow-y-auto space-y-4">
            {renderBlocklists()}
            {renderList('whitelist')}
            {renderList('blacklist')}
          </div>
        </div>
      </div>

      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarMessage.includes('Failed') ? 'error' : 'success'} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  )
} 