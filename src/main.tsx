
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'

import { AuthProvider } from '@/context/AuthContext'
import { OfflineProvider } from '@/context/OfflineContext'
import { PlayerProvider } from '@/context/PlayerContext'
import { ClubProvider } from '@/context/ClubContext'

import './index.css'

// Register the service worker in production only.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Offline shell is an enhancement, never a hard dependency.
      })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OfflineProvider>
          <PlayerProvider>
            <ClubProvider>
              <App />
            </ClubProvider>
          </PlayerProvider>
        </OfflineProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

