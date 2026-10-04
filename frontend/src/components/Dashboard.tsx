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
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!path.trim()) {
      showToast('error', 'Please enter a media file path')
      return
    }
    setBusy(true)
    try {
      const result = await api.createProject({
        name: name.trim() || 'Untitled Project',
        sourcePath: path.trim(),
      })
      showToast('success', 'Project created')
      onCreated(result.id)
    } catch (e: any) {
      showToast('error', e.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="New Project" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Project name</label>
          <input
            className="input-field"
            placeholder="My awesome podcast episode"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
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
        <button className="btn-accent" onClick={submit} disabled={busy}>
          {busy ? <div className="spinner" /> : <Plus size={16} />}
          Create project
        </button>
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
