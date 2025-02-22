'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput } from '@mui/material'
import FileBrowser from './FileBrowser'

interface SambaShare {
  name: string
  path: string
  validUsers: string[]
  readOnly: boolean
  browseable: boolean
  guestOk: boolean
}

interface SambaUser {
  username: string
  groups: string[]
  enabled: boolean
}

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  onSave: (share: SambaShare) => void
  share?: SambaShare
  users: string[]
}

function ShareDialog({ open, onClose, onSave, share, users }: ShareDialogProps) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [validUsers, setValidUsers] = useState<string[]>([])
  const [readOnly, setReadOnly] = useState(true)
  const [browseable, setBrowseable] = useState(true)
  const [guestOk, setGuestOk] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)

  useEffect(() => {
    if (share) {
      setName(share.name)
      setPath(share.path)
      setValidUsers(share.validUsers)
      setReadOnly(share.readOnly)
      setBrowseable(share.browseable)
      setGuestOk(share.guestOk)
    } else {
      setName('')
      setPath('')
      setValidUsers([])
      setReadOnly(true)
      setBrowseable(true)
      setGuestOk(false)
    }
  }, [share])

  useEffect(() => {
    if (!open) {
      if (!share) {
        setName('')
        setPath('')
        setValidUsers([])
        setReadOnly(true)
        setBrowseable(true)
        setGuestOk(false)
      }
    }
  }, [open, share])

  const handleSave = () => {
    onSave({
      name,
      path,
      validUsers,
      readOnly,
      browseable,
      guestOk
    })
  }

  const handleClose = () => {
    setName('')
    setPath('')
    setValidUsers([])
    setReadOnly(true)
    setBrowseable(true)
    setGuestOk(false)
    onClose()
  }

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          className: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        }}
      >
        <DialogTitle className="text-gray-900 dark:text-gray-100 text-xs font-semibold border-b border-gray-200 dark:border-gray-700 py-3">
          {share ? 'Edit Share' : 'Add Share'}
        </DialogTitle>
        <DialogContent className="mt-4 !p-6">
          <div className="space-y-4">
            <TextField
              label="Share Name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!share}
              size="small"
              slotProps={{
                input: {
                  className: 'text-gray-900 dark:text-gray-100 text-xs'
                },
                inputLabel: {
                  className: 'text-gray-600 dark:text-gray-400 text-xs bg-white dark:bg-gray-800'
                }
              }}
            />
            
            <div className="flex gap-2">
              <TextField
                label="Path"
                fullWidth
                value={path}
                size="small"
                slotProps={{
                  input: {
                    className: 'text-gray-900 dark:text-gray-100 text-xs bg-gray-50 dark:bg-gray-700/50',
                    readOnly: true
                  },
                  inputLabel: {
                    className: 'text-gray-600 dark:text-gray-400 text-xs bg-white dark:bg-gray-800'
                  }
                }}
              />
              <button
                onClick={() => setShowFileBrowser(true)}
                className="px-3 h-8 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors whitespace-nowrap"
              >
                Browse
              </button>
            </div>

            <Select
              multiple
              value={validUsers}
              onChange={(e) => setValidUsers(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              input={
                <OutlinedInput 
                  label="Valid Users"
                  className="text-gray-900 dark:text-gray-100"
                  sx={{
                    height: '32px',
                    '& .MuiSelect-select': {
                      color: 'inherit'
                    },
                    '& .MuiSvgIcon-root': {
                      color: 'currentColor'
                    }
                  }}
                />
              }
              renderValue={(selected) => selected.join(', ')}
              size="small"
              fullWidth
              className="text-gray-900 dark:text-gray-100 text-xs"
              sx={{ 
                fontSize: '0.75rem',
                color: 'inherit',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(156, 163, 175, 0.4)'
                },
                '& .MuiSelect-select': {
                  padding: '7px 14px',
                  minHeight: '18px !important',
                  color: 'inherit'
                },
                '& .MuiSvgIcon-root': {
                  color: 'var(--text-color)'
                }
              }}
              MenuProps={{
                PaperProps: {
                  className: 'dark:bg-gray-800',
                  sx: {
                    '& .MuiMenuItem-root': {
                      fontSize: '0.75rem',
                      padding: '6px 14px',
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        '&.dark': {
                          backgroundColor: 'rgba(59, 130, 246, 0.15)'
                        }
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(59, 130, 246, 0.04)',
                        '&.dark': {
                          backgroundColor: 'rgba(59, 130, 246, 0.1)'
                        }
                      }
                    },
                    '& .MuiCheckbox-root': {
                      color: 'rgb(107 114 128)',
                      '&.Mui-checked': {
                        color: 'rgb(59 130 246)'
                      }
                    }
                  }
                }
              }}
            >
              {users.map((user) => (
                <MenuItem key={user} value={user} className="text-gray-900 dark:text-gray-100 text-xs">
                  <Checkbox 
                    checked={validUsers.indexOf(user) > -1} 
                    size="small" 
                    sx={{ 
                      padding: '4px',
                      '& .MuiSvgIcon-root': { 
                        fontSize: '0.875rem'
                      },
                      '&.Mui-checked': {
                        color: 'rgb(59 130 246)'
                      },
                      color: 'rgb(107 114 128)'
                    }} 
                  />
                  <ListItemText 
                    primary={user} 
                    primaryTypographyProps={{ 
                      className: 'text-xs ml-1 text-gray-900 dark:text-gray-100'
                    }} 
                  />
                </MenuItem>
              ))}
            </Select>

            <div className="space-y-2">
              <FormControlLabel
                control={
                  <Switch 
                    checked={!readOnly} 
                    onChange={(e) => setReadOnly(!e.target.checked)} 
                    size="small"
                    sx={{
                      '& .MuiSwitch-thumb': { 
                        width: 12, 
                        height: 12,
                        backgroundColor: 'white'
                      },
                      '& .MuiSwitch-track': {
                        backgroundColor: 'rgb(156 163 175) !important'
                      },
                      '& .Mui-checked': {
                        '& + .MuiSwitch-track': {
                          backgroundColor: 'rgb(59 130 246) !important',
                          opacity: '0.5 !important'
                        }
                      },
                      '& .MuiSwitch-switchBase': {
                        padding: '7px',
                        '&.Mui-checked': {
                          color: '#3b82f6 !important'
                        }
                      }
                    }}
                  />
                }
                label={<span className="text-gray-900 dark:text-gray-100 text-xs">Writable</span>}
                className="m-0"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={browseable} 
                    onChange={(e) => setBrowseable(e.target.checked)} 
                    size="small"
                    sx={{
                      '& .MuiSwitch-thumb': { 
                        width: 12, 
                        height: 12,
                        backgroundColor: 'white'
                      },
                      '& .MuiSwitch-track': {
                        backgroundColor: 'rgb(156 163 175) !important'
                      },
                      '& .Mui-checked': {
                        '& + .MuiSwitch-track': {
                          backgroundColor: 'rgb(59 130 246) !important',
                          opacity: '0.5 !important'
                        }
                      },
                      '& .MuiSwitch-switchBase': {
                        padding: '7px',
                        '&.Mui-checked': {
                          color: '#3b82f6 !important'
                        }
                      }
                    }}
                  />
                }
                label={<span className="text-gray-900 dark:text-gray-100 text-xs">Browseable</span>}
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={guestOk} 
                    onChange={(e) => setGuestOk(e.target.checked)} 
                    size="small"
                    sx={{
                      '& .MuiSwitch-thumb': { 
                        width: 12, 
                        height: 12,
                        backgroundColor: 'white'
                      },
                      '& .MuiSwitch-track': {
                        backgroundColor: 'rgb(156 163 175) !important'
                      },
                      '& .Mui-checked': {
                        '& + .MuiSwitch-track': {
                          backgroundColor: 'rgb(59 130 246) !important',
                          opacity: '0.5 !important'
                        }
                      },
                      '& .MuiSwitch-switchBase': {
                        padding: '7px',
                        '&.Mui-checked': {
                          color: '#3b82f6 !important'
                        }
                      }
                    }}
                  />
                }
                label={<span className="text-gray-900 dark:text-gray-100 text-xs">Allow Guest Access</span>}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
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

      <FileBrowser
        open={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelect={(selectedPath) => {
          setPath(selectedPath)
          setShowFileBrowser(false)
        }}
        initialPath={path}
      />
    </>
  )
}

interface UserDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: { username: string, password?: string, groups: string[], enabled: boolean }) => void
  user?: SambaUser
  groups: string[]
}

function UserDialog({ open, onClose, onSave, user, groups }: UserDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [enabled, setEnabled] = useState(true)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (user) {
      setUsername(user.username)
      setPassword('')
      setSelectedGroups(user.groups)
      setEnabled(user.enabled)
    } else {
      setUsername('')
      setPassword('')
      setSelectedGroups([])
      setEnabled(true)
    }
    setFormError('')
  }, [user])

  const handleSave = () => {
    setFormError('')
    
    // When adding a new user, both username and password are required
    if (!user && (!username || !password)) {
      setFormError('Username and password are required')
      return
    }
    
    // When editing a user, only username is required
    if (user && !username) {
      setFormError('Username is required')
      return
    }

    onSave({
      username,
      password: password || undefined,
      groups: selectedGroups,
      enabled
    })
  }

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
        {user ? 'Edit User' : 'Add User'}
      </DialogTitle>
      <DialogContent className="mt-4 !p-6">
        <div className="space-y-4">
          {formError && (
            <div className="text-red-600 dark:text-red-400 text-xs">
              {formError}
            </div>
          )}
          <TextField
            label="Username"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!!user}
            size="small"
            required
            slotProps={{
              input: {
                className: 'text-gray-900 dark:text-gray-100 text-xs'
              },
              inputLabel: {
                className: 'text-gray-600 dark:text-gray-400 text-xs bg-white dark:bg-gray-800'
              }
            }}
          />
          
          <TextField
            label={user ? 'New Password (optional)' : 'Password'}
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="small"
            required={!user}
            slotProps={{
              input: {
                className: 'text-gray-900 dark:text-gray-100 text-xs'
              },
              inputLabel: {
                className: 'text-gray-600 dark:text-gray-400 text-xs bg-white dark:bg-gray-800'
              }
            }}
          />

          <Select
            multiple
            value={selectedGroups}
            onChange={(e) => setSelectedGroups(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            input={
              <OutlinedInput 
                label="Groups"
                className="text-gray-900 dark:text-gray-100"
                sx={{
                  height: '32px',
                  '& .MuiSelect-select': {
                    color: 'inherit'
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'currentColor'
                  }
                }}
              />
            }
            renderValue={(selected) => selected.join(', ')}
            size="small"
            fullWidth
            className="text-gray-900 dark:text-gray-100 text-xs"
          >
            {groups.map((group) => (
              <MenuItem key={group} value={group} className="text-xs">
                <Checkbox checked={selectedGroups.indexOf(group) > -1} size="small" sx={{ padding: '2px' }} />
                <ListItemText primary={group} className="text-xs" primaryTypographyProps={{ className: 'text-xs ml-1' }} />
              </MenuItem>
            ))}
          </Select>

          {user && (
            <FormControlLabel
              control={
                <Switch 
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  size="small"
                />
              }
              label={
                <span className="text-gray-900 dark:text-gray-100 text-xs">
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              }
            />
          )}
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

interface GroupDialogProps {
  open: boolean
  onClose: () => void
  onSave: (name: string) => void
}

function GroupDialog({ open, onClose, onSave }: GroupDialogProps) {
  const [name, setName] = useState('')

  const handleSave = () => {
    onSave(name)
    setName('')
  }

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
        Add Group
      </DialogTitle>
      <DialogContent className="mt-4 !p-6">
        <div className="space-y-4">
          <TextField
            label="Group Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            slotProps={{
              input: {
                className: 'text-gray-900 dark:text-gray-100 text-xs'
              },
              inputLabel: {
                className: 'text-gray-600 dark:text-gray-400 text-xs bg-white dark:bg-gray-800'
              }
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

export default function SambaSharesCard() {
  const [activeTab, setActiveTab] = useState(0)
  const [shares, setShares] = useState<SambaShare[]>([])
  const [users, setUsers] = useState<SambaUser[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [error, setError] = useState<string>('')
  const [showAddShare, setShowAddShare] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [editingShare, setEditingShare] = useState<SambaShare | undefined>()
  const [editingUser, setEditingUser] = useState<SambaUser | undefined>()

  const loadData = async () => {
    try {
      setError('')
      
      // Load shares
      const sharesResponse = await fetch('/api/samba/shares')
      if (!sharesResponse.ok) throw new Error('Failed to load shares')
      const sharesData = await sharesResponse.json()
      setShares(sharesData)

      // Load users
      const usersResponse = await fetch('/api/samba/users')
      if (!usersResponse.ok) throw new Error('Failed to load users')
      const usersData = await usersResponse.json()
      setUsers(usersData)

      // Load groups
      const groupsResponse = await fetch('/api/samba/users?type=groups')
      if (!groupsResponse.ok) throw new Error('Failed to load groups')
      const groupsData = await groupsResponse.json()
      setGroups(groupsData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load data')
    }
  }

  useEffect(() => {
    loadData()
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSaveShare = async (share: SambaShare) => {
    try {
      setError('')
      const response = await fetch('/api/samba/shares' + (editingShare ? `/${share.name}` : ''), {
        method: editingShare ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(share),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save share')
      }

      setShowAddShare(false)
      setEditingShare(undefined)
      await loadData()
    } catch (error) {
      console.error('Error saving share:', error)
      setError('Failed to save share')
    }
  }

  const handleDeleteShare = async (name: string) => {
    try {
      setError('')
      const response = await fetch(`/api/samba/shares?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete share')
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting share:', error)
      setError('Failed to delete share')
    }
  }

  const handleSaveUser = async (userData: { username: string, password?: string, groups: string[], enabled: boolean }) => {
    try {
      setError('')
      console.log('Sending user data:', userData) // Debug log
      const response = await fetch('/api/samba/users', {
        method: editingUser ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userData.username,
          password: userData.password,
          groups: userData.groups,
          enabled: userData.enabled
        }),
      })

      let errorData;
      try {
        errorData = await response.json()
      } catch (e) {
        console.error('Failed to parse response:', e)
        throw new Error('Server error: Invalid response format')
      }

      if (!response.ok) {
        throw new Error(errorData.error || 'Failed to save user')
      }

      setShowAddUser(false)
      setEditingUser(undefined)
      await loadData()
    } catch (error) {
      console.error('Error saving user:', error)
      setError(error instanceof Error ? error.message : 'Failed to save user')
    }
  }

  const handleDeleteUser = async (username: string) => {
    try {
      setError('')
      const response = await fetch(`/api/samba/users?name=${encodeURIComponent(username)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting user:', error)
      setError('Failed to delete user')
    }
  }

  const handleSaveGroup = async (name: string) => {
    try {
      setError('')
      const response = await fetch('/api/samba/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'group', name }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create group')
      }

      setShowAddGroup(false)
      await loadData()
    } catch (error) {
      console.error('Error creating group:', error)
      setError('Failed to create group')
    }
  }

  const handleDeleteGroup = async (name: string) => {
    try {
      setError('')
      const response = await fetch(`/api/samba/users?type=group&name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete group')
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting group:', error)
      setError('Failed to delete group')
    }
  }

  const handleToggleUser = async (username: string, enabled: boolean) => {
    try {
      setError('')
      const response = await fetch('/api/samba/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, enabled }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update user')
      }

      await loadData()
    } catch (error) {
      console.error('Error updating user:', error)
      setError('Failed to update user')
    }
  }

  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="text-label mb-2">Samba Shares</h3>
        
        {/* Add error display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
            {error}
          </div>
        )}

        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-2">
          <button
            onClick={() => setActiveTab(0)}
            className={`px-3 py-1 text-xs font-medium ${
              activeTab === 0 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Shares
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className={`px-3 py-1 text-xs font-medium ${
              activeTab === 1 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Users & Groups
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 0 && (
            <div className="flex flex-col h-full">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowAddShare(true)}
                  className="btn btn-blue"
                >
                  Add Share
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                      <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Path</th>
                      <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Access</th>
                      <th className="px-2 py-1 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shares.map((share, index) => (
                      <tr 
                        key={share.name} 
                        className={`card-hover ${
                          index % 2 === 0 ? '' : 'card-alternate'
                        } ${index === shares.length - 1 ? 'last-row' : ''}`}
                      >
                        <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{share.name}</td>
                        <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{share.path}</td>
                        <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{share.validUsers.join(', ')}</td>
                        <td className="px-2 py-1 text-xs text-right">
                          <button
                            onClick={() => handleDeleteShare(share.name)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 1 && (
            <div className="flex flex-col h-full">
              <div className="flex justify-end gap-2 mb-2">
                <button
                  onClick={() => setShowAddUser(true)}
                  className="btn btn-blue"
                >
                  Add User
                </button>
                <button
                  onClick={() => setShowAddGroup(true)}
                  className="btn btn-blue"
                >
                  Add Group
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Username</th>
                      <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Groups</th>
                      <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-2 py-1 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => (
                      <tr 
                        key={user.username} 
                        className={`card-hover ${
                          index % 2 === 0 ? '' : 'card-alternate'
                        } ${index === users.length - 1 ? 'last-row' : ''}`}
                      >
                        <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{user.username}</td>
                        <td className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300">{user.groups.join(', ')}</td>
                        <td className="px-2 py-1 text-xs">
                          <button
                            onClick={() => handleToggleUser(user.username, !user.enabled)}
                            className={`px-1.5 py-0.5 rounded ${
                              user.enabled ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                              'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            }`}
                          >
                            {user.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>
                        <td className="px-2 py-1 text-xs text-right">
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Groups</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {groups.map((group) => (
                      <div
                        key={group}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                      >
                        <span className="text-xs text-gray-700 dark:text-gray-300">{group}</span>
                        <button
                          onClick={() => handleDeleteGroup(group)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete Group"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ShareDialog
        open={showAddShare}
        onClose={() => {
          setShowAddShare(false)
          setEditingShare(undefined)
        }}
        onSave={handleSaveShare}
        share={editingShare}
        users={users.map(u => u.username)}
      />

      <UserDialog
        open={showAddUser}
        onClose={() => {
          setShowAddUser(false)
          setEditingUser(undefined)
        }}
        onSave={handleSaveUser}
        user={editingUser}
        groups={groups}
      />

      <GroupDialog
        open={showAddGroup}
        onClose={() => setShowAddGroup(false)}
        onSave={handleSaveGroup}
      />
    </div>
  )
} 