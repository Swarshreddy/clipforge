import { Loader2, CheckCircle2, Circle } from 'lucide-react'

export type PipelineStage =
  | 'importing'
  | 'transcribing'
  | 'analyzing'
  | 'ready'
  | null

const STAGES: { key: Exclude<PipelineStage, null>; label: string }[] = [
  { key: 'importing', label: 'Import' },
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'analyzing', label: 'Analyze' },
  { key: 'ready', label: 'Ready' },
]

const projectStatusToStage: Record<string, Exclude<PipelineStage, null>> = {
  imported: 'importing',
  probed: 'importing',
  audio_extracted: 'transcribing',
  transcribed: 'analyzing',
  analyzed: 'ready',
}

export default function PipelineStatus({
  stage,
  projectStatus,
}: {
  stage: PipelineStage
  projectStatus: string
}) {
  const derived: Exclude<PipelineStage, null> = stage ?? projectStatusToStage[projectStatus] ?? 'ready'
  const activeIndex = STAGES.findIndex((s) => s.key === derived)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '8px 20px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-primary)',
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {STAGES.map((s, i) => {
        const isActive = i === activeIndex
        const isDone = i < activeIndex
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: isActive ? 'var(--accent-secondary)' : isDone ? 'var(--success)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {isActive && derived !== 'ready' ? (
                <Loader2 size={13} className="spinner" />
              ) : isDone || (derived === 'ready' && s.key === 'ready') ? (
                <CheckCircle2 size={13} />
              ) : (
                <Circle size={11} />
              )}
              {s.label}
            </div>
            {i < STAGES.length - 1 && (
              <div style={{ width: 36, height: 1, background: 'var(--border-color)' }} />
            )}
          </div>
        )
      })}
      {stage && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Loader2 size={12} className="spinner" /> Working... you can keep browsing
        </span>
      )}
    </div>
  )
}
