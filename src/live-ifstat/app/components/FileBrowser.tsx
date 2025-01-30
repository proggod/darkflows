'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import path from 'path'

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

export default function FileBrowser({ onSelect, initialPath = '/home', onClose, open }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [error, setError] = useState<string | null>('')
  const [loading, setLoading] = useState(false)

  const fetchDirectory = async (path: string) => {
    try {
      setLoading(true)
      setError(null)
      
      // Ensure path is never empty
      const safePath = path || '/'
      console.log('Fetching directory:', safePath)
      
      const url = `/api/files/list?path=${encodeURIComponent(safePath)}`
      console.log('Request URL:', url)

      const response = await fetch(url)
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Failed to fetch directory: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Directory contents:', data)
      
      setCurrentPath(safePath)
      setEntries(data)
    } catch (error: unknown) {
      console.error('Error fetching directory:', error)
      setError(
        error instanceof Error ? error.message : 'Failed to load directory'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchDirectory(currentPath)
    }
  }, [currentPath, open])

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Browse Files</DialogTitle>
      <DialogContent>
        <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
          Current path: {currentPath}
        </div>
        
        {loading && (
          <div className="text-center py-4">Loading...</div>
        )}

        {error && (
          <div className="text-red-600 dark:text-red-400 mb-2">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-1">
            {currentPath !== '/' && (
              <div 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                onClick={() => fetchDirectory(path.dirname(currentPath))}
              >
                ..
              </div>
            )}
            {entries.map(entry => (
              <div 
                key={entry.name}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                onClick={() => entry.isDirectory ? fetchDirectory(path.join(currentPath, entry.name)) : null}
              >
                {entry.name} {entry.isDirectory ? '/' : ''}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <button
          onClick={onClose}
          className="btn btn-blue"
        >
          Cancel
        </button>
        <button
          onClick={() => onSelect(currentPath)}
          className="btn btn-green"
        >
          Select
        </button>
      </DialogActions>
    </Dialog>
  )
} 