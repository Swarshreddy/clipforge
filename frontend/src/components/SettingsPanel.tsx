import { useEffect, useState } from 'react'
import { X, KeyRound, Loader2, CheckCircle2, XCircle, Save } from 'lucide-react'
import { api } from '../api/client'
import { useEnvironment } from '../hooks/useEnvironment'
import { useToast } from './ui/Toast'

const PROVIDERS = [
  { key: 'deepseek', label: 'DeepSeek', envKey: 'hasDeepseekKey' },
  { key: 'claude', label: 'Claude', envKey: 'hasAnthropicKey' },
  { key: 'openai', label: 'OpenAI', envKey: 'hasOpenaiKey' },
  { key: 'gemini', label: 'Gemini', envKey: 'hasGeminiKey' },
  { key: 'openrouter', label: 'OpenRouter', envKey: 'hasOpenrouterKey' },
  { key: 'groq', label: 'Groq', envKey: 'hasGroqKey' },
  { key: 'ollama', label: 'Ollama (local)', envKey: null },
]

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { status, error } = useEnvironment()
  const { showToast } = useToast()
  const [provider, setProvider] = useState('deepseek')
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({})

  useEffect(() => {
    if (status) setProvider(status.llmProvider)
  }, [status])

  const testProvider = async (key: string) => {
    setTesting(key)
    try {
      const result = await api.testConnection(key)
      setResults((prev) => ({ ...prev, [key]: result }))
    } catch (e: any) {
      setResults((prev) => ({ ...prev, [key]: { ok: false, message: e.message } }))
    } finally {
      setTesting(null)
    }
  }

  const saveProvider = async () => {
    try {
      await api.updateSettings({ LLM_PROVIDER: provider })
      showToast('success', `Default provider set to ${provider}`)
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 8000,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slide-in 0.25s ease',
      }}
    >
      <style>{`@keyframes slide-in { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Settings</h2>
        <button className="btn-ghost" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {error && (
          <div className="badge badge-error" style={{ padding: '8px 12px' }}>
            Could not load status: {error}
          </div>
        )}

        {/* Environment */}
        <section>
          <h3 style={sectionTitle}>Environment</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatusRow label="FFmpeg" ok={!!status?.hasFfmpeg} />
            <StatusRow label="FFprobe" ok={!!status?.hasFfprobe} />
            <StatusRow label="yt-dlp (YouTube import)" ok={!!status?.hasYtdlp} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
            Data dir: {status?.dataDir || '...'}
          </p>
        </section>

        {/* LLM Provider */}
        <section>
          <h3 style={sectionTitle}>
            <KeyRound size={13} style={{ verticalAlign: -1, marginRight: 4 }} />
            AI Provider
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROVIDERS.map((p) => {
              const hasKey = p.envKey ? (status as any)?.[p.envKey] : true
              const result = results[p.key]
              return (
                <div
                  key={p.key}
                  className="glass-card"
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    borderColor: provider === p.key ? 'var(--accent-primary)' : 'var(--border-color)',
                    background: provider === p.key ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-tertiary)',
                  }}
                  onClick={() => setProvider(p.key)}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: provider === p.key ? 'var(--accent-secondary)' : 'var(--text-muted)',
                      background: provider === p.key ? 'var(--accent-secondary)' : 'transparent',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                  <div style={{ flex: 1 }} />
                  {p.envKey && (
                    <span className={`badge ${hasKey ? 'badge-success' : 'badge-error'}`}>
                      {hasKey ? 'key set' : 'no key'}
                    </span>
                  )}
                  <button
                    className="btn-ghost"
                    style={{ padding: 4 }}
                    title="Test connection"
                    onClick={(e) => {
                      e.stopPropagation()
                      testProvider(p.key)
                    }}
                  >
                    {testing === p.key ? <Loader2 size={13} className="spinner" /> : <span style={{ fontSize: 11 }}>Test</span>}
                  </button>
                  {result && (result.ok ? <CheckCircle2 size={14} color="var(--success)" /> : <XCircle size={14} color="var(--error)" />)}
                </div>
              )
            })}
          </div>
          <button className="btn-accent" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={saveProvider}>
            <Save size={14} />
            Save provider
          </button>
        </section>

        {/* Privacy note */}
        <section>
          <h3 style={sectionTitle}>Privacy</h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            All processing happens locally. Media files never leave your machine — only transcripts
            are sent to the AI provider you choose (except in offline mode, where nothing leaves
            your machine at all).
          </p>
        </section>
      </div>
    </div>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className={`badge ${ok ? 'badge-success' : 'badge-error'}`}>
        {ok ? 'installed' : 'missing'}
      </span>
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--text-secondary)',
  marginBottom: 10,
}
