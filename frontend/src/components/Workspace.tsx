import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, Settings, Download, XCircle } from 'lucide-react'
import { api, type Candidate, type TranscriptData } from '../api/client'
import { useProject } from '../hooks/useProject'
import { useToast } from './ui/Toast'
import MediaPlayer from './MediaPlayer'
import TranscriptView from './TranscriptView'
import CandidateList from './CandidateList'
import PipelineStatus, { type PipelineStage } from './PipelineStatus'

export default function Workspace({
  projectId,
  onBack,
  onOpenSettings,
}: {
  projectId: string
  onBack: () => void
  onOpenSettings: () => void
}) {
  const { detail, loading, error, refresh } = useProject(projectId)
  const { showToast } = useToast()
  const [currentTime, setCurrentTime] = useState(0)
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null)

  const transcript: TranscriptData | null = useMemo(() => {
    if (!detail?.transcript) return null
    try {
      return JSON.parse(detail.transcript.raw_json)
    } catch {
      return null
    }
  }, [detail])

  const pollStatus = useCallback(
    async (kind: 'transcribe' | 'analyze') => {
      const check = async (): Promise<boolean> => {
        try {
          const status =
            kind === 'transcribe'
              ? await api.getTranscriptionStatus(projectId)
              : await api.getAnalysisStatus(projectId)
          if (status.status === 'done') return true
          if (status.status === 'error') {
            showToast('error', status.error || `${kind} failed`)
            return true
          }
          return false
        } catch {
          return false
        }
      }
      while (!(await check())) {
        await new Promise((r) => setTimeout(r, 1500))
      }
      await refresh()
      setPipelineStage(null)
    },
    [projectId, refresh, showToast]
  )

  const handleTranscribe = async () => {
    try {
      setPipelineStage('transcribing')
      await api.transcribe(projectId)
      showToast('info', 'Transcription started')
      pollStatus('transcribe')
    } catch (e: any) {
      setPipelineStage(null)
      showToast('error', e.message)
    }
  }

  const handleAnalyze = async () => {
    try {
      setPipelineStage('analyzing')
      await api.analyze(projectId)
      showToast('info', 'AI analysis started')
      pollStatus('analyze')
    } catch (e: any) {
      setPipelineStage(null)
      showToast('error', e.message)
    }
  }

  const handleRender = async (candidate: Candidate) => {
    try {
      showToast('info', 'Rendering clip...')
      const result = await api.renderClip(projectId, candidate.id)
      // Poll render status
      const pollRender = async () => {
        for (let i = 0; i < 600; i++) {
          const status = await api.getClipStatus(result.clipId)
          if (status.status === 'done') {
            showToast('success', 'Clip rendered!')
            refresh()
            return
          }
          if (status.status === 'error') {
            showToast('error', status.log || 'Render failed')
            refresh()
            return
          }
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
      pollRender()
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  const handleBatchRender = async () => {
    try {
      showToast('info', 'Batch render started')
      await api.renderBatch(projectId)
      setTimeout(refresh, 2000)
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  if (loading && !detail) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <div className="spinner" />
        <span>Loading project...</span>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <XCircle size={32} color="var(--error)" />
        <span>{error || 'Project not found'}</span>
        <button className="btn-secondary" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    )
  }

  const project = detail.project
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <button className="btn-ghost" onClick={onBack} title="Back to dashboard">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </h1>
          <p
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {project.source_path}
          </p>
        </div>
        <button className="btn-secondary" onClick={handleBatchRender} disabled={detail.candidates.length === 0}>
          <Download size={15} />
          Export selected ({detail.candidates.filter((c) => c.selected).length})
        </button>
        <button className="btn-ghost" onClick={onOpenSettings} title="Settings">
          <Settings size={17} />
        </button>
      </header>

      {/* Pipeline status bar */}
      <PipelineStatus stage={pipelineStage} projectStatus={project.status} />

      {/* Main 3-panel layout */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: media player */}
        <div
          style={{
            width: 380,
            flexShrink: 0,
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
          }}
        >
          <MediaPlayer projectId={projectId} hasTranscript={!!detail.transcript} onTimeUpdate={setCurrentTime} onTranscribe={handleTranscribe} />
        </div>

        {/* Center: transcript */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <TranscriptView transcript={transcript} currentTime={currentTime} onAnalyze={handleAnalyze} analyzing={pipelineStage === 'analyzing'} />
        </div>

        {/* Right: candidates */}
        <div
          style={{
            width: 400,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
          }}
        >
          <CandidateList
            candidates={detail.candidates}
            clips={detail.clips}
            onRender={handleRender}
            onSeek={(sec) => setCurrentTime(sec)}
            onSelectToggle={async (candidate, selected) => {
              const currentSelected = detail.candidates.filter((c) => c.selected).map((c) => c.id)
              const next = selected
                ? [...currentSelected, candidate.id]
                : currentSelected.filter((id) => id !== candidate.id)
              await api.updateCandidates(projectId, next)
              refresh()
            }}
          />
        </div>
      </div>
    </div>
  )
}
