import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initializeAuth } from './features/auth/store'

const disposeAuth = initializeAuth()
if (import.meta.hot) import.meta.hot.dispose(disposeAuth)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
