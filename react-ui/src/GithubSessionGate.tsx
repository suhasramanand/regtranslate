import { type ReactNode, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { scannerGithubSession } from './api'
import './App.css'

type GateState = 'loading' | 'in' | 'out'

/**
 * Renders children only when Compliance Scanner reports an active GitHub session; otherwise redirects to /login.
 */
export function GithubSessionGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [state, setState] = useState<GateState>('loading')

  useEffect(() => {
    let cancelled = false
    scannerGithubSession()
      .then((s) => {
        if (!cancelled) setState(s.connected ? 'in' : 'out')
      })
      .catch(() => {
        if (!cancelled) setState('out')
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (state === 'loading') {
    return (
      <div className="app-auth-wait" role="status" aria-live="polite">
        <div className="app-auth-wait-card" aria-busy="true">
          <Loader2 size={36} className="spinner" strokeWidth={2} />
          <p className="app-auth-wait-text">Confirming your sign-in…</p>
        </div>
      </div>
    )
  }

  if (state === 'out') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
