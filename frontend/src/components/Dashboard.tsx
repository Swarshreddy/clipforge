import { useState } from 'react'
import {
  Clapperboard,
  Plus,
  Settings,
  Search,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { api, type Project } from '../api/client'
import { useProjects } from '../hooks/useProjects'
import { useToast } from './ui/Toast'
import Modal from './ui/Modal'
import ProjectCard from './ProjectCard'

export default function Dashboard({
  onOpenProject,
  onOpenSettings,
  needsOnboarding,
  onStartOnboarding,
}: {
  onOpenProject: (projectId: string) => void
  onOpenSettings: () => void
  needsOnboarding: boolean
  onStartOnboarding: () => void
}) {
  const { projects, loading, error, refresh } = useProjects()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return
    try {
      await api.deleteProject(project.id)
      showToast('success', 'Project deleted')
      refresh()
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  const handleRename = async (project: Project) => {
    const name = window.prompt('New project name', project.name)
    if (!name || name === project.name) return
    try {
      await api.renameProject(project.id, name)
      showToast('success', 'Project renamed')
      refresh()
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clapperboard size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>ClipForge</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              AI-powered short-form clip studio
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-secondary" onClick={onOpenSettings}>
            <Settings size={15} />
            Settings
          </button>
          <button className="btn-accent" onClick={() => setNewProjectOpen(true)}>
            <Plus size={16} />
            New Project
          </button>
        </div>
      </header>

      {needsOnboarding && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 24px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderBottom: '1px solid var(--border-color)',
            color: 'var(--warning)',
            fontSize: 13,
          }}
        >
          <AlertTriangle size={15} />
          <span style={{ flex: 1 }}>
            FFmpeg was not detected. Clips cannot be rendered without it.
          </span>
          <button className="btn-secondary" style={{ padding: '4px 12px' }} onClick={onStartOnboarding}>
            Run setup
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input
            className="input-field"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {projects.length} project{projects.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading && (
          <div className="empty-state">
            <div className="spinner" />
            <span>Loading projects...</span>
          </div>
        )}
        {error && (
          <div className="empty-state">
            <AlertTriangle size={32} color="var(--error)" />
            <span>{error}</span>
            <button className="btn-secondary" onClick={refresh}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && projects.length === 0 && (
          <div className="empty-state">
            <Sparkles size={40} color="var(--accent-primary)" />
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Welcome to ClipForge</h2>
            <p style={{ maxWidth: 420, fontSize: 14, lineHeight: 1.6 }}>
              Turn long videos into viral-ready vertical clips. Create your first project to get
              started — everything runs locally on your machine.
            </p>
            <button className="btn-accent" onClick={() => setNewProjectOpen(true)}>
              <Plus size={16} />
              Create your first project
            </button>
          </div>
        )}
        {projects.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => onOpenProject(p.id)}
                onRename={() => handleRename(p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        )}
      </div>

      {newProjectOpen && (
        <NewProjectModal
          onClose={() => setNewProjectOpen(false)}
          onCreated={(id) => {
            setNewProjectOpen(false)
            refresh()
            onOpenProject(id)
          }}
        />
      )}
    </div>
  )
}

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { showToast } = useToast()
  const [mode, setMode] = useState<'file' | 'youtube'>('file')
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)

  // YouTube import state
  const [ytUrl, setYtUrl] = useState('')
  const [checking, setChecking] = useState(false)
  const [copyrightMsg, setCopyrightMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')

  const createProject = async (sourcePath: string, projectName?: string) => {
    setBusy(true)
    try {
      const result = await api.createProject({
        name: projectName || name.trim() || 'Untitled Project',
        sourcePath,
      })
      showToast('success', 'Project created')
      onCreated(result.id)
    } catch (e: any) {
      showToast('error', e.message)
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!path.trim()) {
      showToast('error', 'Please enter a media file path')
      return
    }
    await createProject(path.trim())
  }

  const onFileSelected = (file: File | undefined) => {
    if (!file) return
    // pywebview/Electron expose the real path; browsers give a fake path.
    const realPath = (file as any).path || file.name
    setPath(realPath)
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ''))
  }

  const checkYoutube = async () => {
    if (!ytUrl.trim()) {
      showToast('error', 'Please enter a YouTube URL')
      return
    }
    setChecking(true)
    setCopyrightMsg(null)
    try {
      const result: any = await api.checkYoutube(ytUrl.trim())
      if (result.ok) {
        setCopyrightMsg({
          ok: !result.isLikelyCopyrighted,
          message: `"${result.title || 'Video'}" · ${result.reason || 'Looks good'}`,
        })
      } else {
        setCopyrightMsg({ ok: false, message: result.error || 'Copyright check failed' })
      }
    } catch (e: any) {
      setCopyrightMsg({ ok: false, message: e.message })
    } finally {
      setChecking(false)
    }
  }

  const downloadYoutube = async () => {
    if (!ytUrl.trim()) {
      showToast('error', 'Please enter a YouTube URL')
      return
    }
    if (!copyrightMsg) {
      setCopyrightMsg({ ok: false, message: 'Run "Check & Download" first so we can verify the video.' })
      return
    }
    setDownloading(true)
    setDownloadProgress('Starting download...')
    try {
      const { jobId } = await api.downloadYoutube(ytUrl.trim())
      // Poll download status
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const res = await api.getYoutubeDownloadStatus(jobId)
        if (res.status === 'done' && res.path) {
          setDownloadProgress('Download complete — creating project...')
          showToast('success', 'Video downloaded')
          await createProject(res.path)
          setDownloading(false)
          return
        }
        if (res.status === 'error') {
          setDownloadProgress('')
          showToast('error', res.error || 'Download failed')
          setDownloading(false)
          return
        }
        setDownloadProgress('Downloading video...')
      }
      setDownloading(false)
      setDownloadProgress('')
      showToast('error', 'Download timed out')
    } catch (e: any) {
      setDownloading(false)
      setDownloadProgress('')
      showToast('error', e.message)
    }
  }

  return (
    <Modal title="New Project" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Source tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--bg-tertiary)',
            padding: 4,
            borderRadius: 8,
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              color: mode === 'file' ? 'var(--text-primary)' : 'var(--text-muted)',
              background: mode === 'file' ? 'var(--bg-secondary)' : 'transparent',
            }}
            onClick={() => setMode('file')}
          >
            Local file
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              color: mode === 'youtube' ? 'var(--text-primary)' : 'var(--text-muted)',
              background: mode === 'youtube' ? 'var(--bg-secondary)' : 'transparent',
            }}
            onClick={() => setMode('youtube')}
          >
            YouTube
          </button>
        </div>

        <div>
          <label style={labelStyle}>Project name</label>
          <input
            className="input-field"
            placeholder="My awesome podcast episode"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={downloading}
          />
        </div>

        {mode === 'file' ? (
          <>
            <div>
              <label style={labelStyle}>Media file path</label>
              <input
                className="input-field"
                placeholder="/path/to/video.mp4 (MP4, MOV, MKV, MP3, WAV...)"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Enter the full path to a video or audio file on this machine.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Browse local file</label>
              <input
                type="file"
                accept="video/*,audio/*"
                onChange={(e) => onFileSelected(e.target.files?.[0])}
                style={{ fontSize: 13, color: 'var(--text-secondary)' }}
              />
            </div>
            <button className="btn-accent" onClick={submit} disabled={busy}>
              {busy ? <div className="spinner" /> : <Plus size={16} />}
              Create project
            </button>
          </>
        ) : (
          <>
            <div>
              <label style={labelStyle}>YouTube URL</label>
              <input
                className="input-field"
                placeholder="https://www.youtube.com/watch?v=..."
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                disabled={downloading}
              />
            </div>

            {copyrightMsg && (
              <div
                className={`badge ${copyrightMsg.ok ? 'badge-success' : 'badge-error'}`}
                style={{ padding: '8px 12px', whiteSpace: 'normal' }}
              >
                {copyrightMsg.message}
              </div>
            )}

            {(downloading || downloadProgress) && (
              <div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    className="progress-bar"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: downloading ? '45%' : '100%',
                      background: 'var(--accent-gradient)',
                    }}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {downloadProgress}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={checkYoutube}
                disabled={checking || downloading}
              >
                {checking ? <div className="spinner" /> : <Search size={14} />}
                Check & Download
              </button>
              <button
                className="btn-accent"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={downloadYoutube}
                disabled={downloading || busy}
              >
                {downloading ? <div className="spinner" /> : <Plus size={14} />}
                Download & Create
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
}
