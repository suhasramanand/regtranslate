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
import { getPostAuthRedirectPath } from './authRedirect'
import { useTheme } from './useTheme'
import './App.css'
import './LoginPage.css'

const SIGNUP_STEPS = [
  {
    title: 'Connect GitHub',
    body: 'We use GitHub to identify you and (when you use the scanner) read your repositories with the access you grant.',
  },
  {
    title: 'Workspace opens',
    body: 'The first time you connect, we prepare your workspace automatically. Returning users pick up where they left off.',
  },
  {
    title: 'Start working',
    body: 'Land on the dashboard, run scans, or explore the guided demo anytime without signing in.',
  },
] as const

export function SignupPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = getPostAuthRedirectPath(location)

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
        'One-click GitHub isn’t available on this deployment. Use “Connect with credential” below, or ask your administrator to enable browser sign-in.',
      )
      return
    }
    setError(null)
    const next = `${window.location.origin}${fromPath}?connected=1`
    window.location.href = `${SCANNER_API_BASE}/auth/github/login?next=` + encodeURIComponent(next)
  }

  const connectWithToken = async () => {
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
      setError(e instanceof Error ? e.message : 'Connection failed')
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
          <p className="app-auth-wait-text">Checking your account…</p>
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
            <nav className="login-page-nav" aria-label="Account shortcuts">
              <Link to="/" className="login-page-nav-link">
                Home
              </Link>
              <Link to="/scanner" className="login-page-nav-link">
                Compliance
              </Link>
              <Link to="/login" className="login-page-nav-link">
                Sign in
              </Link>
            </nav>
          </div>
          <div className="login-page-header-actions">
            <button
              type="button"
              className={`login-header-icon-btn${oauthConfigured ? ' login-header-icon-btn--primary' : ''}`}
              onClick={connectGithub}
              aria-label="Continue with GitHub in the browser"
              title={
                oauthConfigured
                  ? 'Continue with GitHub in the browser'
                  : 'Use “Connect with credential” in the form'
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
        <div className="login-panel login-panel--signup">
          <p className="login-page-eyebrow">New workspace</p>
          <h1 className="login-page-title">Create your RegTranslate access</h1>
          <p className="login-page-lead">
            There isn’t a separate “register” form: <strong>your first GitHub sign-in creates your access</strong>. Use
            the same steps when you come back — we never ask you to pick “sign up” vs “sign in” at GitHub.
          </p>

          <ol className="login-signup-steps" aria-label="How access works">
            {SIGNUP_STEPS.map((step, i) => (
              <li key={step.title} className="login-signup-step">
                <span className="login-signup-step-num" aria-hidden>
                  {i + 1}
                </span>
                <div className="login-signup-step-body">
                  <strong className="login-signup-step-title">{step.title}</strong>
                  <span className="login-signup-step-text">{step.body}</span>
                </div>
              </li>
            ))}
          </ol>

          {error && (
            <div className="alert alert-error login-alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="login-actions login-actions--signup-oauth">
            <button
              type="button"
              className="btn btn-primary login-btn-full"
              onClick={connectGithub}
              disabled={!oauthConfigured}
            >
              <Github size={18} strokeWidth={2} aria-hidden />
              Continue with GitHub
            </button>
            {!oauthConfigured && (
              <p className="login-hint-muted login-hint-muted--tight">
                Browser GitHub sign-in isn’t configured here. Use a credential below, or ask your admin to enable OAuth.
              </p>
            )}
          </div>

          <p className="login-auth-divider" role="separator">
            Or connect with a credential
          </p>

          <div className="input-group login-token-field">
            <label htmlFor="signup-pat">GitHub credential</label>
            <input
              id="signup-pat"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') connectWithToken()
              }}
              placeholder="Personal access token or fine-grained token"
            />
          </div>

          <div className="login-actions login-actions--single">
            <button
              type="button"
              className="btn btn-primary login-btn-full"
              onClick={() => connectWithToken()}
              disabled={!!loading || !token.trim()}
            >
              {loading === 'pat' ? <Loader2 size={18} className="spinner" /> : <KeyRound size={18} />}
              Connect with credential
            </button>
          </div>

          {!oauthConfigured && (
            <details className="login-details">
              <summary>Why isn’t the green GitHub button available?</summary>
              <p className="login-details-body">
                One-click OAuth needs client ID and secret on the Compliance Scanner service. Self-hosted teams enable
                that in their config; until then, paste a token with the scopes your administrator documents.
              </p>
            </details>
          )}

          {sessionLogin && (
            <div className="login-session-row">
              <span className="scanner-session-pill">
                <CheckCircle2 size={14} />
                Connected as <strong>{sessionLogin}</strong>
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
          Already have access?{' '}
          <Link to="/login" className="login-page-footer-link">
            Sign in
          </Link>
          <span className="login-page-footer-sep" aria-hidden>
            ·
          </span>
          <Link to="/dashboard?demo=1" className="login-page-footer-link">
            Try the guided demo
          </Link>
        </p>
      </footer>
    </div>
  )
}
