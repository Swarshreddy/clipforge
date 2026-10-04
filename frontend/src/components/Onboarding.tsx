import { useState } from 'react'
import {
  Clapperboard,
  Cloud,
  HardDrive,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  KeyRound,
} from 'lucide-react'
import { api } from '../api/client'
import { useEnvironment } from '../hooks/useEnvironment'
import { useToast } from './ui/Toast'

type Step = 'welcome' | 'mode' | 'keys' | 'done'

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome')
  const [mode, setMode] = useState<'cloud' | 'offline'>('cloud')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [deepgramKey, setDeepgramKey] = useState('')
  const [testing, setTesting] = useState(false)
  const { status } = useEnvironment()
  const { showToast } = useToast()

  const steps: { key: Step; label: string }[] = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'mode', label: 'Choose mode' },
    { key: 'keys', label: 'API keys' },
    { key: 'done', label: 'Ready' },
  ]
  const stepIndex = steps.findIndex((s) => s.key === step)

  const testConnection = async () => {
    setTesting(true)
    try {
      const result = await api.testConnection('deepseek')
      if (result.ok) {
        showToast('success', `Connected (${result.latencyMs}ms)`)
      } else {
        showToast('error', result.message)
      }
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at top, rgba(124,58,237,0.15), transparent 60%), var(--bg-primary)',
        padding: 24,
      }}
    >
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: i < stepIndex ? 'var(--success)' : i === stepIndex ? 'var(--accent-gradient)' : 'var(--bg-elevated)',
                color: i <= stepIndex ? 'white' : 'var(--text-muted)',
              }}
            >
              {i < stepIndex ? <Check size={13} /> : i + 1}
            </div>
            <span style={{ fontSize: 12, color: i === stepIndex ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div style={{ width: 32, height: 1, background: 'var(--border-color)' }} />
            )}
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ width: 520, padding: 32, background: 'var(--bg-secondary)' }}>
        {step === 'welcome' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
              }}
            >
              <Clapperboard size={30} color="white" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Welcome to ClipForge</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 400 }}>
              Turn long-form videos into viral-ready vertical clips — fully local, fully private.
              Let's set things up in under a minute.
            </p>
            <button className="btn-accent" onClick={() => setStep('mode')} style={{ marginTop: 8 }}>
              Get started <ArrowRight size={15} />
            </button>
          </div>
        )}

        {step === 'mode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>How do you want to run AI?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              You can change this later in Settings.
            </p>
            <ModeCard
              icon={<Cloud size={22} />}
              title="Cloud AI (recommended)"
              description="Fastest and most accurate. Requires API keys: DeepSeek for analysis, Deepgram for transcription."
              selected={mode === 'cloud'}
              onClick={() => setMode('cloud')}
              available={!!status?.hasFfmpeg}
            />
            <ModeCard
              icon={<HardDrive size={22} />}
              title="Fully offline"
              description="Uses Ollama for analysis and local Whisper for transcription. No API keys needed, but slower and requires downloads."
              selected={mode === 'offline'}
              onClick={() => setMode('offline')}
              available={!!status?.hasFfmpeg}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => setStep('welcome')}>
                <ArrowLeft size={15} /> Back
              </button>
              <button className="btn-accent" onClick={() => setStep('keys')}>
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 'keys' && mode === 'cloud' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              <KeyRound size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
              Add your API keys
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Keys are stored locally in <code style={{ fontFamily: 'var(--font-mono)' }}>.env</code> and never
              leave your machine except to call the provider APIs directly.
            </p>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                DeepSeek API key <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(viral analysis)</span>
              </label>
              <input
                className="input-field"
                type="password"
                placeholder="sk-..."
                value={deepseekKey}
                onChange={(e) => setDeepseekKey(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Deepgram API key <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(transcription)</span>
              </label>
              <input
                className="input-field"
                type="password"
                placeholder="Optional — can also use local Whisper"
                value={deepgramKey}
                onChange={(e) => setDeepgramKey(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 size={14} className="spinner" /> : null}
                Test connection
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn-secondary" onClick={() => setStep('mode')}>
                <ArrowLeft size={15} /> Back
              </button>
              <button className="btn-accent" onClick={() => setStep('done')}>
                Skip for now
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Get keys at platform.deepseek.com and console.deepgram.com
            </p>
          </div>
        )}

        {step === 'keys' && mode === 'offline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Offline setup</h2>
            <div className="glass-card" style={{ padding: 16, fontSize: 13, lineHeight: 1.7, background: 'var(--bg-tertiary)' }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Setup checklist</p>
              <p>1. Install Ollama from ollama.com and run <code style={{ fontFamily: 'var(--font-mono)' }}>ollama serve</code></p>
              <p>2. Pull a model: <code style={{ fontFamily: 'var(--font-mono)' }}>ollama pull llama3.2</code></p>
              <p>3. Install Whisper: <code style={{ fontFamily: 'var(--font-mono)' }}>pip install openai-whisper</code></p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-secondary" onClick={() => setStep('mode')}>
                <ArrowLeft size={15} /> Back
              </button>
              <button className="btn-accent" onClick={() => setStep('done')}>
                I'm set up
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={30} color="var(--success)" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>You're all set!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.6 }}>
              Create a project, import a video, and let the AI find your most viral moments.
            </p>
            <button className="btn-accent" onClick={onComplete}>
              Open dashboard <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ModeCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  selected: boolean
  onClick: () => void
  available?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className="glass-card"
      style={{
        padding: 16,
        display: 'flex',
        gap: 14,
        cursor: 'pointer',
        borderColor: selected ? 'var(--accent-primary)' : 'var(--border-color)',
        background: selected ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-tertiary)',
        transition: 'all var(--transition-fast)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: selected ? 'var(--accent-gradient)' : 'var(--bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: selected ? 'white' : 'var(--text-secondary)',
        }}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
      </div>
      {selected && <Check size={18} color="var(--accent-secondary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
    </div>
  )
}
