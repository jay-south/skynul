import type React from 'react'
import { Component } from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
          <span className="text-nb-danger text-lg font-semibold">Something went wrong</span>
          <span className="text-nb-muted text-sm text-center max-w-md">
            {this.state.error?.message}
          </span>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-md bg-nb-accent-2 text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            Try again
          </button>
        </div>
      )
    )
  }
}
