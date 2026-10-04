import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<{ showToast: (kind: ToastKind, message: string) => void }>({
  showToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const icons: Record<ToastKind, ReactNode> = {
    success: <CheckCircle2 size={16} color="var(--success)" />,
    error: <AlertCircle size={16} color="var(--error)" />,
    info: <Info size={16} color="var(--info)" />,
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 10000,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              minWidth: 280,
              maxWidth: 420,
              fontSize: 14,
              boxShadow: 'var(--shadow-lg)',
              animation: 'toast-in 0.25s ease',
            }}
          >
            {icons[t.kind]}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button className="btn-ghost" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </ToastContext.Provider>
  )
}
