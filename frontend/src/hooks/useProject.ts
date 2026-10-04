import { useCallback, useEffect, useState } from 'react'
import { api, type ProjectDetail } from '../api/client'

export function useProject(projectId: string | null) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    try {
      setError(null)
      const data = await api.getProject(projectId)
      setDetail(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) {
      setDetail(null)
      return
    }
    setLoading(true)
    refresh()
  }, [projectId, refresh])

  return { detail, loading, error, refresh }
}
