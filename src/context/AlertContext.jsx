import { createContext, useCallback, useContext, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { btnPrimary } from '../lib/ui'

const AlertContext = createContext(null)

// Fournit une modale d'erreur centrée, appelable partout via useAlert().
export function AlertProvider({ children }) {
  const [state, setState] = useState(null) // { message, title }

  const showAlert = useCallback((message, title = 'Champ requis') => {
    setState({ message, title })
  }, [])

  const close = () => setState(null)

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}

      <Modal
        open={!!state}
        onClose={close}
        title={state?.title || ''}
        maxWidth="max-w-sm"
        footer={
          <>
            <div className="flex-1" />
            <button type="button" onClick={close} className={btnPrimary}>
              Compris
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-c-danger/15 text-c-danger">
            <AlertTriangle size={18} />
          </span>
          <p className="pt-1.5 text-sm text-text-secondary">{state?.message}</p>
        </div>
      </Modal>
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlert must be used within AlertProvider')
  return ctx
}
