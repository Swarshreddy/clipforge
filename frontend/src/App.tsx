import { useCallback, useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import Workspace from './components/Workspace'
import Onboarding from './components/Onboarding'
import SettingsPanel from './components/SettingsPanel'
import { ToastProvider } from './components/ui/Toast'
import { useEnvironment } from './hooks/useEnvironment'

type View =
  | { page: 'onboarding' }
  | { page: 'dashboard' }
  | { page: 'workspace'; projectId: string }

export default function App() {
  const { status } = useEnvironment()
  const [view, setView] = useState<View>({ page: 'dashboard' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('clipforge.onboarded') === '1'
  )

  // If environment is not configured (no ffmpeg or no LLM key at all), show onboarding first
  useEffect(() => {
    if (status && !onboardingDismissed && !status.hasFfmpeg) {
      setView({ page: 'onboarding' })
    }
  }, [status, onboardingDismissed])

  const completeOnboarding = useCallback(() => {
    localStorage.setItem('clipforge.onboarded', '1')
    setOnboardingDismissed(true)
    setView({ page: 'dashboard' })
  }, [])

  return (
    <ToastProvider>
      {view.page === 'onboarding' && (
        <Onboarding onComplete={completeOnboarding} />
      )}
      {view.page === 'dashboard' && (
        <Dashboard
          onOpenProject={(projectId) => setView({ page: 'workspace', projectId })}
          onOpenSettings={() => setSettingsOpen(true)}
          needsOnboarding={!!status && !status.hasFfmpeg}
          onStartOnboarding={() => setView({ page: 'onboarding' })}
        />
      )}
      {view.page === 'workspace' && (
        <Workspace
          projectId={view.projectId}
          onBack={() => setView({ page: 'dashboard' })}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </ToastProvider>
  )
}
