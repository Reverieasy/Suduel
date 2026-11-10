import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/battle.css'
import './styles/arena.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initializeAuth } from './features/auth/store'
import { AudioSystem } from './features/audio/AudioSystem'

const disposeAuth = initializeAuth()
if (import.meta.hot) import.meta.hot.dispose(disposeAuth)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><AudioSystem /><App /></ErrorBoundary>
  </StrictMode>,
)
