'use client'

import { useState, useEffect } from 'react'
import { Tabs, Tab, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput } from '@mui/material'
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

  return (
    <>
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
          {share ? 'Edit Share' : 'Add Share'}
        </DialogTitle>
        <DialogContent>
          <div className="mt-6 space-y-3">
            <TextField
              label="Share Name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!share}
              size="small"
              InputLabelProps={{
                className: 'text-gray-600 dark:text-gray-400 text-xs',
                sx: { 
                  '&.MuiInputLabel-shrink': { top: 2 },
                  '&:not(.MuiInputLabel-shrink)': { top: -2 }
                }
              }}
              InputProps={{
                className: 'text-gray-900 dark:text-gray-100 text-xs',
                sx: { height: '28px' }
              }}
              sx={{ 
                '& .MuiOutlinedInput-root': { height: '28px' },
                '& .MuiOutlinedInput-input': { 
                  height: '28px',
                  lineHeight: '28px',
                  padding: '0 8px'
                }
              }}
            />
            
            <div className="flex gap-2">
              <TextField
                label="Path"
                fullWidth
                value={path}
                InputProps={{
                  readOnly: true,
                  className: 'text-gray-900 dark:text-gray-100 text-xs',
                  sx: { height: '28px' }
                }}
                sx={{ 
                  '& .MuiOutlinedInput-input': { 
                    cursor: 'default',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              />
              <Button
                variant="outlined"
                onClick={() => setShowFileBrowser(true)}
                size="small"
                className="text-xs"
              >
                Browse
              </Button>
            </div>

            <Select
              multiple
              value={validUsers}
              onChange={(e) => setValidUsers(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              input={
                <OutlinedInput 
                  label="Valid Users" 
                  className="text-xs"
                  sx={{ height: '28px' }}
                />
              }
              renderValue={(selected) => selected.join(', ')}
              size="small"
              fullWidth
              className="text-gray-900 dark:text-gray-100 text-xs"
              sx={{ 
                '& .MuiOutlinedInput-root': { height: '28px' },
                '& .MuiSelect-select': { paddingTop: 0, paddingBottom: 0 }
              }}
              MenuProps={{
                PaperProps: {
                  sx: { 
                    '& .MuiMenuItem-root': { 
                      minHeight: '24px',
                      padding: '2px 8px'
                    }
                  }
                }
              }}
            >
              {users.map((user) => (
                <MenuItem key={user} value={user} className="text-xs">
                  <Checkbox checked={validUsers.indexOf(user) > -1} size="small" sx={{ padding: '2px' }} />
                  <ListItemText primary={user} className="text-xs" primaryTypographyProps={{ className: 'text-xs ml-1' }} />
                </MenuItem>
              ))}
            </Select>

            <div className="space-y-2">
              <FormControlLabel
                control={<Switch checked={!readOnly} onChange={(e) => setReadOnly(!e.target.checked)} size="small" />}
                label={<span className="text-gray-900 dark:text-gray-100 text-xs">Writable</span>}
              />
              <FormControlLabel
                control={<Switch checked={browseable} onChange={(e) => setBrowseable(e.target.checked)} size="small" />}
                label={<span className="text-gray-900 dark:text-gray-100 text-xs">Browseable</span>}
              />
              <FormControlLabel
                control={<Switch checked={guestOk} onChange={(e) => setGuestOk(e.target.checked)} size="small" />}
                label={<span className="text-gray-900 dark:text-gray-100 text-xs">Allow Guest Access</span>}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" className="text-xs">
            Save
          </Button>
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
      <DialogContent className="mt-8">
        <div className="space-y-3">
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
            InputLabelProps={{
              className: 'text-gray-600 dark:text-gray-400 text-xs',
              sx: { '&.MuiInputLabel-shrink': { top: 2 } }
            }}
            InputProps={{
              className: 'text-gray-900 dark:text-gray-100 text-xs',
              sx: { height: '28px' }
            }}
            sx={{ 
              '& .MuiOutlinedInput-root': { height: '28px' },
              '& .MuiOutlinedInput-input': { paddingTop: 0, paddingBottom: 0 }
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
            InputLabelProps={{
              className: 'text-gray-600 dark:text-gray-400 text-xs',
              sx: { '&.MuiInputLabel-shrink': { top: 2 } }
            }}
            InputProps={{
              className: 'text-gray-900 dark:text-gray-100 text-xs',
              sx: { height: '28px' }
            }}
            sx={{ 
              '& .MuiOutlinedInput-root': { height: '28px' },
              '& .MuiOutlinedInput-input': { paddingTop: 0, paddingBottom: 0 }
            }}
          />

          <Select
            multiple
            value={selectedGroups}
            onChange={(e) => setSelectedGroups(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            input={
              <OutlinedInput 
                label="Groups" 
                className="text-xs"
                sx={{ height: '28px' }}
              />
            }
            renderValue={(selected) => selected.join(', ')}
            size="small"
            fullWidth
            className="text-gray-900 dark:text-gray-100 text-xs"
            sx={{ 
              '& .MuiOutlinedInput-root': { height: '28px' },
              '& .MuiSelect-select': { paddingTop: 0, paddingBottom: 0 }
            }}
            MenuProps={{
              PaperProps: {
                sx: { 
                  '& .MuiMenuItem-root': { 
                    minHeight: '24px',
                    padding: '2px 8px'
                  }
                }
              }
            }}
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
        <Button onClick={onClose} className="text-xs">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" className="text-xs">
          Save
        </Button>
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
      <DialogContent className="mt-8">
        <TextField
          label="Group Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          InputLabelProps={{
            className: 'text-gray-600 dark:text-gray-400 text-xs',
            sx: { '&.MuiInputLabel-shrink': { top: 2 } }
          }}
          InputProps={{
            className: 'text-gray-900 dark:text-gray-100 text-xs',
            sx: { height: '28px' }
          }}
          sx={{ 
            '& .MuiOutlinedInput-root': { height: '28px' },
            '& .MuiOutlinedInput-input': { paddingTop: 0, paddingBottom: 0 }
          }}
        />
      </DialogContent>
      <DialogActions className="p-4">
        <Button onClick={onClose} className="text-xs">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" className="text-xs">
          Save
        </Button>
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

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-[490px] flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Samba Shares</h2>
        <Button
          size="small"
          variant="outlined"
          onClick={loadData}
          className="text-xs min-w-0 px-2"
          title="Refresh"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
            <path d="M3 22v-6h6"></path>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
          </svg>
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        className="border-b border-gray-200 dark:border-gray-700"
        sx={{
          minHeight: '32px',
          '& .MuiTab-root': {
            minHeight: '32px',
            padding: '4px 16px',
            fontSize: '12px',
            color: 'inherit'
          }
        }}
      >
        <Tab label="Shares" />
        <Tab label="Users & Groups" />
      </Tabs>

      <div className="flex-grow overflow-auto mt-2">
        {activeTab === 0 && (
          <div className="flex flex-col h-full">
            <div className="flex justify-end mb-2">
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowAddShare(true)}
                className="text-xs"
              >
                Add Share
              </Button>
            </div>
            <div className="flex-grow overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Path</th>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Access</th>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800">
                  {shares.map((share) => (
                    <tr key={share.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{share.name}</td>
                      <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{share.path}</td>
                      <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                        {share.validUsers.join(', ')}
                      </td>
                      <td className="px-2 whitespace-nowrap text-xs">
                        <button
                          onClick={() => {
                            setEditingShare(share)
                            setShowAddShare(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-2"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path>
                            <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteShare(share.name)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
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
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowAddUser(true)}
                className="text-xs"
              >
                Add User
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowAddGroup(true)}
                className="text-xs"
              >
                Add Group
              </Button>
            </div>
            <div className="flex-grow overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Username</th>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Groups</th>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800">
                  {users.map((user) => (
                    <tr key={user.username} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{user.username}</td>
                      <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                        {user.groups.join(', ')}
                      </td>
                      <td className="px-2 whitespace-nowrap text-xs">
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
                      <td className="px-2 whitespace-nowrap text-xs">
                        <button
                          onClick={() => {
                            setEditingUser(user)
                            setShowAddUser(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-2"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path>
                            <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.username)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
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