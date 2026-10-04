import { useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, FileAudio, Mic } from 'lucide-react'
import { api } from '../api/client'

export default function MediaPlayer({
  projectId,
  hasTranscript,
  onTimeUpdate,
  onTranscribe,
}: {
  projectId: string
  hasTranscript: boolean
  onTimeUpdate: (time: number) => void
  onTranscribe: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const src = api.mediaFileUrl(projectId)

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || !duration) return
    const ratio = (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth
    video.currentTime = ratio * duration
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          minHeight: 0,
          position: 'relative',
        }}
      >
        <video
          ref={videoRef}
          src={src}
          controls={false}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setCurrentTime(t)
            onTimeUpdate(t)
            setProgress(duration ? (t / duration) * 100 : 0)
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => setError('Could not load media. Check the file exists on disk.')}
        />
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-secondary)', padding: 24, textAlign: 'center' }}>
            <FileAudio size={36} color="var(--text-muted)" />
            <span style={{ fontSize: 13 }}>{error}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: 16, borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div
          onClick={handleSeek}
          className="progress-bar"
          style={{ cursor: 'pointer', marginBottom: 12 }}
        >
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-accent" style={{ padding: 10, borderRadius: '50%' }} onClick={togglePlay}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
                      <button
              className="btn-ghost"
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                v.muted = !v.muted
                setMuted(v.muted)
              }}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {!hasTranscript && (
          <button className="btn-accent" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={onTranscribe}>
            <Mic size={15} />
            Transcribe audio
          </button>
        )}
      </div>
    </div>
  )
}

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
