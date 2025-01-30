'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught an error:', error)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 h-full flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-label">Error</h3>
          </div>
          <div className="text-center py-4 text-muted">
            Something went wrong. Please try refreshing the page.
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-2 text-xs text-red-500">
                {this.state.error.toString()}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
} 