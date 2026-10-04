import { Clapperboard, Film, Clock, Trash2, Pencil, FolderOpen } from 'lucide-react'
import type { Project } from '../api/client'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

const statusLabels: Record<string, { label: string; className: string }> = {
  imported: { label: 'Imported', className: 'badge-info' },
  probed: { label: 'Probed', className: 'badge-info' },
  audio_extracted: { label: 'Audio extracted', className: 'badge-info' },
  transcribing: { label: 'Transcribing', className: 'badge-warning' },
  transcribed: { label: 'Transcribed', className: 'badge-warning' },
  analyzing: { label: 'Analyzing', className: 'badge-warning' },
  analyzed: { label: 'Clips ready', className: 'badge-success' },
  rendering: { label: 'Rendering', className: 'badge-warning' },
  rendered: { label: 'Rendered', className: 'badge-success' },
  error: { label: 'Error', className: 'badge-error' },
}

export default function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const status = statusLabels[project.status] ?? { label: project.status, className: 'badge-info' }
  const fileName = project.source_path.split('/').pop() || project.source_path

  return (
    <div
      className="glass-card"
      style={{
        padding: 16,
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onClick={onOpen}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
    >
      <div
        style={{
          height: 110,
          borderRadius: 'var(--border-radius-md)',
          background:
            'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.12))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Clapperboard size={32} color="var(--accent-secondary)" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={project.name}
          >
            {project.name}
          </h3>
          <span className={`badge ${status.className}`} style={{ flexShrink: 0 }}>
            {status.label}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
          }}
        >
          <Film size={12} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={project.source_path}
          >
            {fileName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} />
            {formatDuration(project.source_duration)}
          </span>
          <span>{formatDate(project.created_at)}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 4,
          borderTop: '1px solid var(--border-color)',
          paddingTop: 10,
        }}
      >
        <button
          className="btn-ghost"
          title="Open project"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          <FolderOpen size={15} />
        </button>
        <button
          className="btn-ghost"
          title="Rename"
          onClick={(e) => {
            e.stopPropagation()
            onRename()
          }}
        >
          <Pencil size={15} />
        </button>
        <button
          className="btn-ghost danger"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
