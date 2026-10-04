const API_BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!response.ok) {
    let message = response.statusText
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      const text = await response.text()
      if (text) message = text
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export interface EnvironmentStatus {
  dataDir: string
  hasFfmpeg: boolean
  hasFfprobe: boolean
  hasDeepgramKey: boolean
  hasDeepseekKey: boolean
  hasAnthropicKey: boolean
  hasGeminiKey: boolean
  hasOpenaiKey: boolean
  hasOpenrouterKey: boolean
  hasGroqKey: boolean
  hasCustomProvider: boolean
  llmProvider: string
  hasYtdlp: boolean
}

export interface Project {
  id: string
  name: string
  source_path: string
  source_duration: number | null
  status: string
  transcription_mode: string
  caption_style: string
  created_at: string
  updated_at: string
}

export interface Candidate {
  id: string
  project_id: string
  start_sec: number
  end_sec: number
  score: number
  hook: string
  rationale: string
  rank: number
  selected: number
}

export interface Clip {
  id: string
  candidate_id: string
  status: string
  output_path: string | null
  render_log: string | null
}

export interface ProjectDetail {
  project: Project
  transcript: { id: string; raw_json: string; language: string; engine: string } | null
  candidates: Candidate[]
  clips: Clip[]
}

export interface TranscriptData {
  language: string
  duration: number
  speakers: string[]
  words: { text: string; start: number; end: number; speaker?: string }[]
  segments: { start: number; end: number; text: string; speaker?: string }[]
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  latencyMs: number | null
}

export const api = {
  getStatus: () => request<EnvironmentStatus>('/status'),
  listProjects: () => request<Project[]>('/projects'),
  createProject: (data: { name: string; sourcePath: string; transcriptionMode?: string; duration?: number }) =>
    request<{ id: string }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  renameProject: (id: string, name: string) =>
    request<void>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  probeMedia: (id: string) => request(`/projects/${id}/probe`, { method: 'POST' }),
  extractAudio: (id: string) => request(`/projects/${id}/extract-audio`, { method: 'POST' }),
  transcribe: (id: string, mode?: string) =>
    request(`/projects/${id}/transcribe`, { method: 'POST', body: JSON.stringify({ mode }) }),
  getTranscriptionStatus: (id: string) =>
    request<{ status: string; error?: string }>(`/projects/${id}/transcribe/status`),
  analyze: (id: string, provider?: string) =>
    request(`/projects/${id}/analyze`, { method: 'POST', body: JSON.stringify({ provider }) }),
  getAnalysisStatus: (id: string) =>
    request<{ status: string; error?: string }>(`/projects/${id}/analyze/status`),
  renderClip: (projectId: string, candidateId: string, captionStyle?: string) =>
    request<{ clipId: string }>(`/projects/${projectId}/render/${candidateId}`, {
      method: 'POST',
      body: JSON.stringify({ captionStyle }),
    }),
  getClipStatus: (clipId: string) =>
    request<{ status: string; log?: string }>(`/clips/${clipId}/status`),
  renderBatch: (projectId: string) =>
    request<{ clipIds: string[] }>(`/projects/${projectId}/render-batch`, { method: 'POST' }),
  updateCandidates: (projectId: string, selectedIds: string[]) =>
    request(`/projects/${projectId}/candidates`, {
      method: 'PATCH',
      body: JSON.stringify({ selectedIds }),
    }),
  testConnection: (provider: string) =>
    request<ConnectionTestResult>('/test-connection', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),
  checkYoutube: (url: string) =>
    request(`/youtube/check`, { method: 'POST', body: JSON.stringify({ url }) }),
  downloadYoutube: (url: string) =>
    request<{ jobId: string }>(`/youtube/download`, { method: 'POST', body: JSON.stringify({ url }) }),
  getYoutubeDownloadStatus: (jobId: string) =>
    request<{ status: string; path?: string; error?: string }>(`/youtube/download/${jobId}`),
  pullOllama: (model: string) =>
    request(`/ollama/pull`, { method: 'POST', body: JSON.stringify({ model }) }),
  getSettings: () => request<Record<string, string>>('/settings'),
  updateSettings: (data: Record<string, string>) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  mediaFileUrl: (projectId: string) => `${API_BASE}/projects/${projectId}/file`,
  clipFileUrl: (clipId: string) => `${API_BASE}/clips/${clipId}/file`,
}
