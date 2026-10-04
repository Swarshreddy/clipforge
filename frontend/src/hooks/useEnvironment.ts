import { useEffect, useState } from 'react'
import { api, type EnvironmentStatus } from '../api/client'

export function useEnvironment() {
  const [status, setStatus] = useState<EnvironmentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getStatus()
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { status, error }
}
