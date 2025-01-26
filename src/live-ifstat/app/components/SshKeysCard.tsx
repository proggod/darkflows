'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh';

interface SshKey {
  id: string
  type: string
  key: string
  comment?: string
}

interface UserKeys {
  username: string
  keys: SshKey[]
}

interface KeyDialogProps {
  open: boolean
  onClose: () => void
  onSave: (key: string) => void
  username: string
}

function KeyDialog({ open, onClose, onSave, username }: KeyDialogProps) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!key.trim()) {
      setError('Key is required')
      return
    }
    try {
      await onSave(key.trim())
      setKey('')
      setError('')
    } catch (err) {
      // Show the error message from the API
      setError(err instanceof Error ? err.message : 'Failed to add key')
    }
  }

  // Clear error when dialog closes
  useEffect(() => {
    if (!open) {
      setError('')
      setKey('')
    }
  }, [open])

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
      }}
    >
      <DialogTitle className="text-gray-900 dark:text-gray-100 text-xs font-semibold border-b border-gray-200 dark:border-gray-700">
        Add SSH Key for {username}
      </DialogTitle>
      <DialogContent>
        <div className="mt-4 space-y-3">
          {error && (
            <div className="text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}
          <TextField
            label="SSH Public Key"
            multiline
            rows={4}
            fullWidth
            value={key}
            onChange={(e) => setKey(e.target.value)}
            size="small"
            placeholder="ssh-rsa AAAA..."
            InputLabelProps={{
              className: 'text-gray-600 dark:text-gray-400 text-xs'
            }}
            InputProps={{
              className: 'text-gray-900 dark:text-gray-100 text-xs'
            }}
          />
        </div>
      </DialogContent>
      <DialogActions className="p-4">
        <button
          onClick={onClose}
          className="h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="h-6 px-2 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 transition-colors"
        >
          Save
        </button>
      </DialogActions>
    </Dialog>
  )
}

export default function SshKeysCard() {
  const [users, setUsers] = useState<UserKeys[]>([])
  const [error, setError] = useState('')
  const [showAddKey, setShowAddKey] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')

  const loadData = async () => {
    try {
      setError('')
      const response = await fetch('/api/ssh-keys')
      if (!response.ok) throw new Error('Failed to load SSH keys')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error loading SSH keys:', error)
      setError('Failed to load SSH keys')
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSaveKey = async (key: string) => {
    try {
      setError('')
      const response = await fetch('/api/ssh-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: selectedUser,
          key
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add key')
      }

      setShowAddKey(false)
      await loadData()
    } catch (error) {
      console.error('Error adding key:', error)
      throw error // Re-throw to be caught by dialog error handler
    }
  }

  const handleDeleteKey = async (username: string, keyId: string) => {
    try {
      setError('')
      const response = await fetch(`/api/ssh-keys?username=${encodeURIComponent(username)}&keyId=${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete key')
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting key:', error)
      setError('Failed to delete key')
    }
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-800 rounded-lg p-2 shadow-sm transition-colors duration-200">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">SSH Keys</h3>
          <div className="flex gap-2">
            <RefreshIcon 
              onClick={loadData}
              className="w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
            {error}
          </div>
        )}

        <div className="overflow-auto flex-grow">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">Username</th>
                <th className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Keys</th>
                <th className="px-1 py-0.5 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.username} className={`hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/20'
                }`}>
                  <td className="px-1 py-0.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{user.username}</td>
                  <td className="px-1 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                    {user.keys.map(key => (
                      <div key={key.id} className="flex items-center truncate">
                        <span className="font-mono">{key.type}</span>
                        {key.comment && (
                          <span className="text-gray-500 truncate ml-1">{key.comment}</span>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="px-1 py-0.5 whitespace-nowrap text-xs">
                    <div className="flex flex-col items-end gap-0.5">
                      {user.keys.map(key => (
                        <div key={key.id} className="flex items-center gap-1">
                          {key === user.keys[0] && (
                            <button
                              onClick={() => {
                                setSelectedUser(user.username)
                                setShowAddKey(true)
                              }}
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Add Key"
                            >
                              +
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteKey(user.username, key.id)}
                            className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete Key"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18"></path>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      ))}
                      {user.keys.length === 0 && (
                        <button
                          onClick={() => {
                            setSelectedUser(user.username)
                            setShowAddKey(true)
                          }}
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Add Key"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <KeyDialog
        open={showAddKey}
        onClose={() => {
          setShowAddKey(false)
          setSelectedUser('')
        }}
        onSave={handleSaveKey}
        username={selectedUser}
      />
    </div>
  )
} 