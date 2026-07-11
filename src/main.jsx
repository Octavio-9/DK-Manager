import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { AlertProvider } from './context/AlertContext'

// Mise à jour automatique de la PWA installée.
// Le service worker ne cherche une nouvelle version qu'au chargement de la page ;
// sur une app installée, l'OS la garde en mémoire et ne recharge pas.
// On force donc une vérification (1) dès que l'app repasse au premier plan et
// (2) toutes les heures. En mode « autoUpdate », dès qu'une nouvelle version est
// trouvée, elle s'installe et la page se recharge automatiquement.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AlertProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#1f1d2b',
                  color: '#f0eef8',
                  border: '1px solid #2e2b3d',
                },
              }}
            />
          </AlertProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
