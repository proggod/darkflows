'use client'

import { useState, useEffect } from 'react'
import { TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'

interface FileBrowserProps {
  onSelect: (path: string) => void
  initialPath?: string
  onClose: () => void
  open: boolean
}

interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export default function FileBrowser({ onSelect, initialPath = '/', onClose, open }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const loadDirectory = async (path: string) => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load directory')
      }
      
      setEntries(data)
    } catch (error) {
      console.error('Error loading directory:', error)
      setError('Failed to load directory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadDirectory(currentPath)
    }
  }, [currentPath, open])

  const handleNavigate = (entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path)
    }
  }

  const handleParentDirectory = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/')
    setCurrentPath(parent || '/')
  }

  const handleCreateFolder = async () => {
    if (!newFolderName) return

    try {
      setError('')
      const response = await fetch('/api/files/create-dir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: `${currentPath}/${newFolderName}`.replace(/\/+/g, '/'),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create directory')
      }

      setShowNewFolder(false)
      setNewFolderName('')
      loadDirectory(currentPath)
    } catch (error) {
      console.error('Error creating directory:', error)
      setError('Failed to create directory')
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        className: 'bg-white dark:bg-gray-800'
      }}
    >
      <DialogTitle className="flex justify-between items-center text-gray-900 dark:text-gray-100 text-sm font-semibold border-b border-gray-200 dark:border-gray-700">
        <span>Select Directory</span>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowNewFolder(true)}
            className="text-xs"
          >
            New Folder
          </Button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </DialogTitle>

      <DialogContent className="bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-4 mt-2">
          <Button
            size="small"
            onClick={handleParentDirectory}
            disabled={currentPath === '/'}
            className="text-xs"
          >
            Parent Directory
          </Button>
          <div className="text-sm text-gray-600 dark:text-gray-300 flex-grow truncate">
            {currentPath}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-gray-600 dark:text-gray-400">
            Loading...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {entries.map((entry) => (
              <div
                key={entry.path}
                onClick={() => handleNavigate(entry)}
                className={`
                  p-2 rounded cursor-pointer text-sm
                  ${entry.isDirectory ? 
                    'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40' : 
                    'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}
                `}
              >
                <div className="flex items-center gap-2">
                  {entry.isDirectory ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                  )}
                  <span className="truncate">{entry.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <DialogActions className="border-t border-gray-200 dark:border-gray-700 p-4">
        <Button
          variant="contained"
          onClick={() => onSelect(currentPath)}
          className="text-xs"
        >
          Select Directory
        </Button>
      </DialogActions>

      <Dialog
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        PaperProps={{
          className: 'bg-white dark:bg-gray-800'
        }}
      >
        <DialogTitle className="text-gray-900 dark:text-gray-100 text-sm font-semibold border-b border-gray-200 dark:border-gray-700">
          Create New Folder
        </DialogTitle>
        <DialogContent className="mt-4">
          <TextField
            autoFocus
            label="Folder Name"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            size="small"
          />
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={() => setShowNewFolder(false)} className="text-xs">
            Cancel
          </Button>
          <Button onClick={handleCreateFolder} variant="contained" className="text-xs">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
} 