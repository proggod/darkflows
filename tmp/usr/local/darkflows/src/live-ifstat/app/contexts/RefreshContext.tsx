'use client'

import { createContext, useContext, useCallback, useState } from 'react'

interface RefreshContextType {
  triggerRefresh: () => void
  registerRefreshCallback: (callback: () => void) => () => void
}

const RefreshContext = createContext<RefreshContextType | null>(null)

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshCallbacks] = useState(() => new Set<() => void>())

  const triggerRefresh = useCallback(() => {
    refreshCallbacks.forEach(callback => callback())
  }, [refreshCallbacks])

  const registerRefreshCallback = useCallback((callback: () => void) => {
    refreshCallbacks.add(callback)
    return () => refreshCallbacks.delete(callback)
  }, [refreshCallbacks])

  return (
    <RefreshContext.Provider value={{ triggerRefresh, registerRefreshCallback }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  const context = useContext(RefreshContext)
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider')
  }
  return context
} 