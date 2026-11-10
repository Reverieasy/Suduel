import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SUDUEL could not render this screen.', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return <div className="empty-state" role="alert"><span className="eyebrow red">SOMETHING WENT WRONG</span><h1>LET’S RESET THE BOARD.</h1><p>This screen couldn’t load. Refresh to try again. Saved practice records stay in this browser.</p><button className="button" onClick={() => window.location.reload()}>REFRESH PAGE</button></div>
    }
    return this.props.children
  }
}
