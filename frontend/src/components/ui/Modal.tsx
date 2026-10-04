import { type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  title,
  onClose,
  children,
  width = 480,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: 24,
          background: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button className="btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
