import { useEffect, useMemo, useRef } from 'react'
import { FileText, Sparkles, Loader2 } from 'lucide-react'
import type { TranscriptData } from '../api/client'

export default function TranscriptView({
  transcript,
  currentTime,
  onAnalyze,
  analyzing,
}: {
  transcript: TranscriptData | null
  currentTime: number
  onAnalyze: () => void
  analyzing: boolean
}) {
  const activeRef = useRef<HTMLDivElement>(null)

  const activeSegmentIndex = useMemo(() => {
    if (!transcript) return -1
    return transcript.segments.findIndex(
      (s) => currentTime >= s.start - 0.2 && currentTime <= s.end + 0.2
    )
  }, [transcript, currentTime])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeSegmentIndex])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={15} color="var(--accent-secondary)" />
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Transcript</h2>
          {transcript && (
            <span className="badge badge-accent">{transcript.language?.toUpperCase()}</span>
          )}
        </div>
        {transcript && (
          <button className="btn-accent" onClick={onAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 size={14} className="spinner" /> : <Sparkles size={14} />}
            {analyzing ? 'Analyzing...' : 'Find viral moments'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {!transcript && (
          <div className="empty-state" style={{ height: '100%' }}>
            <FileText size={36} color="var(--text-muted)" />
            <p style={{ fontSize: 14 }}>
              No transcript yet. Play the media and click <strong>Transcribe audio</strong> to
              generate one.
            </p>
          </div>
        )}
        {transcript && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {transcript.segments.map((seg, i) => {
              const isActive = i === activeSegmentIndex
              return (
                <div
                  key={i}
                  ref={isActive ? activeRef : undefined}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '8px 12px',
                    borderRadius: 'var(--border-radius-md)',
                    background: isActive ? 'rgba(124, 58, 237, 0.12)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: isActive ? 'var(--accent-secondary)' : 'var(--text-muted)',
                      flexShrink: 0,
                      paddingTop: 2,
                      cursor: 'pointer',
                    }}
                  >
                    {formatTimestamp(seg.start)}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {seg.text}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
