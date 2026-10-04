import { useMemo } from 'react'
import {
  TrendingUp,
  Loader2,
  Scissors,
  CheckSquare,
  Square,
} from 'lucide-react'
import { type Candidate, type Clip } from '../api/client'

export default function CandidateList({
  candidates,
  clips,
  onRender,
  onSeek,
  onSelectToggle,
}: {
  candidates: Candidate[]
  clips: Clip[]
  onRender: (candidate: Candidate) => void
  onSeek: (sec: number) => void
  onSelectToggle: (candidate: Candidate, selected: boolean) => void
}) {
  const clipByCandidate = useMemo(() => {
    const map: Record<string, Clip> = {}
    for (const clip of clips) map[clip.candidate_id] = map[clip.candidate_id] || clip
    return map
  }, [clips])

  const clipStatus = (candidateId: string): 'pending' | 'rendering' | 'done' => {
    const clip = clipByCandidate[candidateId]
    if (!clip) return 'pending'
    if (clip.status === 'done') return 'done'
    return 'rendering'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <TrendingUp size={15} color="var(--accent-secondary)" />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Clip candidates</h2>
        {candidates.length > 0 && (
          <span className="badge badge-accent">{candidates.length}</span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {candidates.length === 0 && (
          <div className="empty-state" style={{ height: '100%' }}>
            <Scissors size={36} color="var(--text-muted)" />
            <p style={{ fontSize: 14 }}>
              No candidates yet. Once the transcript is ready, click <strong>Find viral moments</strong>.
            </p>
          </div>
        )}
        {candidates.map((candidate) => {
          const status = clipStatus(candidate.id)
          return (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              status={status}
              onRender={() => onRender(candidate)}
              onSeek={() => onSeek(candidate.start_sec)}
              onSelectToggle={(selected) => onSelectToggle(candidate, selected)}
            />
          )
        })}
      </div>
    </div>
  )
}

function CandidateCard({
  candidate,
  onRender,
  onSeek,
  onSelectToggle,
  status,
}: {
  candidate: Candidate
  onRender: () => void
  onSeek: (sec: number) => void
  onSelectToggle: (selected: boolean) => void
  status: 'pending' | 'rendering' | 'done'
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--bg-tertiary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="badge badge-accent"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          >
            #{candidate.rank}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            onClick={() => onSeek(candidate.start_sec)}
            title="Jump to this moment"
          >
            {formatTime(candidate.start_sec)} - {formatTime(candidate.end_sec)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              color: candidate.score >= 80 ? 'var(--success)' : candidate.score >= 60 ? 'var(--warning)' : 'var(--text-secondary)',
            }}
          >
            {Math.round(candidate.score)}
          </span>
          <FlameIcon score={candidate.score} />
        </div>
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{candidate.hook}</p>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{candidate.rationale}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <button
          className="btn-ghost"
          style={{ padding: '4px 8px', fontSize: 12 }}
          onClick={() => onSelectToggle(!(candidate.selected === 1))}
        >
          {candidate.selected ? <CheckSquare size={14} color="var(--accent-secondary)" /> : <Square size={14} />}
          Select
        </button>
        <button
          className={status === 'done' ? 'btn-secondary' : 'btn-accent'}
          style={{ padding: '6px 14px' }}
          onClick={onRender}
        >
          {status === 'rendering' ? (
            <>
              <Loader2 size={13} className="spinner" /> Rendering...
            </>
          ) : status === 'done' ? (
            <>
              <CheckSquare size={13} /> Re-render
            </>
          ) : (
            <>
              <Scissors size={13} /> Render clip
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function FlameIcon({ score }: { score: number }) {
  if (score >= 85) return <span style={{ fontSize: 13 }}>🔥</span>
  if (score >= 70) return <span style={{ fontSize: 12, color: 'var(--warning)' }}>hot</span>
  return null
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
