import { useCallback, useEffect, useState } from 'react'
import { FileText, Github, KeyRound, Loader2, AlertTriangle, CheckCircle2, LogOut, Moon, Sun } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  SCANNER_API_BASE,
  scannerGithubDisconnect,
  scannerGithubPatLogin,
  scannerGithubSession,
  scannerGithubStatus,
} from './api'
import { useTheme } from './useTheme'
import './App.css'
import './LoginPage.css'

export function LoginPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  const nextQuery = new URLSearchParams(location.search).get('next')
  const safeNext =
    nextQuery && nextQuery.startsWith('/') && !nextQuery.startsWith('//') ? nextQuery : null
  const fromPath =
    (fromState && fromState.startsWith('/') && !fromState.startsWith('//') ? fromState : null) || safeNext || '/dashboard'

  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [sessionLogin, setSessionLogin] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState<false | 'pat'>(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'form'>('checking')

  const loadSession = useCallback(async () => {
    try {
      const [st, sess] = await Promise.all([scannerGithubStatus(), scannerGithubSession()])
      setOauthConfigured(st.oauth_configured)
      const ok = !!(sess.connected && sess.login)
      setSessionLogin(ok ? sess.login! : null)
      return ok
    } catch {
      setOauthConfigured(false)
      setSessionLogin(null)
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSession()
      .then((ok) => {
        if (cancelled) return
        if (ok) navigate(fromPath, { replace: true })
        else setPhase('form')
      })
      .catch(() => {
        if (!cancelled) setPhase('form')
      })
    return () => {
      cancelled = true
    }
  }, [loadSession, navigate, fromPath])

  const connectGithub = () => {
    if (!oauthConfigured) {
      setError(
        'One-click GitHub sign-in isn’t available here. Use “Sign in with credential” below, or ask your administrator to enable browser sign-in.',
      )
      return
    }
    setError(null)
    const next = `${window.location.origin}${fromPath}?connected=1`
    window.location.href = `${SCANNER_API_BASE}/auth/github/login?next=` + encodeURIComponent(next)
  }

  const signInWithToken = async () => {
    const t = token.trim()
    if (!t) {
      setError('Enter your GitHub credential.')
      return
    }
    setLoading('pat')
    setError(null)
    try {
      await scannerGithubPatLogin(t)
      await loadSession()
      setToken('')
      navigate(fromPath, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const disconnect = async () => {
    setError(null)
    try {
      await scannerGithubDisconnect()
      setSessionLogin(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign out failed')
    }
  }

  if (phase === 'checking') {
    return (
      <div className="app-auth-wait" role="status" aria-live="polite">
        <div className="app-auth-wait-card" aria-busy="true">
          <Loader2 size={36} className="spinner" strokeWidth={2} />
          <p className="app-auth-wait-text">Checking sign-in…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <header className="login-page-header">
        <div className="login-page-header-inner">
          <div className="login-page-brand-row">
            <Link to="/" className="login-page-brand">
              <span className="login-page-brand-icon">
                <FileText size={20} strokeWidth={2} aria-hidden />
              </span>
              <span>RegTranslate</span>
            </Link>
            <nav className="login-page-nav" aria-label="Sign in shortcuts">
              <Link to="/" className="login-page-nav-link">
                Home
              </Link>
              <Link to="/scanner" className="login-page-nav-link">
                Compliance
              </Link>
            </nav>
          </div>
          <div className="login-page-header-actions">
            <button
              type="button"
              className={`login-header-icon-btn${oauthConfigured ? ' login-header-icon-btn--primary' : ''}`}
              onClick={connectGithub}
              aria-label="Sign in with GitHub in the browser"
              title={
                oauthConfigured
                  ? 'Sign in with GitHub in the browser'
                  : 'Use “Sign in with credential” below'
              }
            >
              <Github size={20} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className="login-page-theme"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="login-page-main">
        <div className="login-panel">
          <p className="login-page-eyebrow">Secure access</p>
          <h1 className="login-page-title">Sign in to continue</h1>
          <p className="login-page-lead">
            Use the <strong>GitHub</strong> icon in the header when one-click sign-in is enabled, or paste a GitHub
            credential below to continue.
          </p>

          {error && (
            <div className="alert alert-error login-alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="input-group login-token-field">
            <label htmlFor="login-pat">GitHub credential</label>
            <input
              id="login-pat"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') signInWithToken()
              }}
              placeholder="Paste credential"
            />
          </div>

          <div className="login-actions login-actions--single">
            <button
              type="button"
              className="btn btn-primary login-btn-full"
              onClick={() => signInWithToken()}
              disabled={!!loading || !token.trim()}
            >
              {loading === 'pat' ? <Loader2 size={18} className="spinner" /> : <KeyRound size={18} />}
              Sign in with credential
            </button>
          </div>

          {!oauthConfigured && (
            <details className="login-details">
              <summary>Can’t use GitHub in the browser?</summary>
              <p className="login-details-body">
                Your team can enable one-click GitHub for RegTranslate Compliance. Until then, sign in with a GitHub
                credential above.
              </p>
            </details>
          )}

          {sessionLogin && (
            <div className="login-session-row">
              <span className="scanner-session-pill">
                <CheckCircle2 size={14} />
                Signed in as <strong>{sessionLogin}</strong>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={disconnect}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </main>
      <footer className="login-page-footer">
        <p className="login-page-footer-text">
          New to RegTranslate?{' '}
          <Link to="/dashboard?demo=1" className="login-page-footer-link">
            Try the guided demo
          </Link>
        </p>
      </footer>
    </div>
  )
}
