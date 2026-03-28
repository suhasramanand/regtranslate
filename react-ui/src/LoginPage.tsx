import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Github, Loader2, AlertTriangle, CheckCircle2, LogOut, Mail } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  GITHUB_OAUTH_API_BASE,
  authLogin,
  authLogout,
  authMe,
  scannerGithubDisconnect,
  scannerGithubSession,
  scannerGithubStatus,
} from './api'
import { getPostAuthRedirectPath } from './authRedirect'
import { dashboardPath } from './dashboardPaths'
import { SiteHeader } from './SiteHeader'
import './App.css'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = getPostAuthRedirectPath(location)

  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [sessionGithub, setSessionGithub] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'form'>('checking')
  const [showEmailPassword, setShowEmailPassword] = useState(false)

  const loadSession = useCallback(async () => {
    try {
      const [st, sess, me] = await Promise.all([scannerGithubStatus(), scannerGithubSession(), authMe()])
      setOauthConfigured(st.oauth_configured)
      const ghOk = !!(sess.connected && sess.login)
      const emailOk = me.authenticated === true && me.method === 'email' && !!me.email
      const devOk = me.authenticated === true && (me.method === 'dev' || me.method === 'demo')
      setSessionGithub(ghOk ? sess.login! : null)
      setSessionEmail(emailOk ? me.email! : null)
      return ghOk || emailOk || devOk
    } catch {
      setOauthConfigured(false)
      setSessionGithub(null)
      setSessionEmail(null)
      return false
    }
  }, [])

  useEffect(() => {
    const prev = document.title
    document.title = 'Sign in · RegTranslate'
    return () => {
      document.title = prev
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
        'GitHub sign-in isn’t available on this deployment. Ask your administrator to configure GitHub OAuth, or sign in with email and password.',
      )
      return
    }
    setError(null)
    const next = `${window.location.origin}${dashboardPath({ view: 'settings' })}&connected=1`
    window.location.href = `${GITHUB_OAUTH_API_BASE}/auth/github/login?next=` + encodeURIComponent(next)
  }

  const signInWithEmail = async () => {
    const em = email.trim()
    if (!em || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await authLogin(em, password)
      setPassword('')
      await loadSession()
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
      if (sessionEmail) await authLogout()
    } catch {
      /* still clear UI */
    }
    try {
      if (sessionGithub) await scannerGithubDisconnect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign out failed')
      return
    }
    setSessionGithub(null)
    setSessionEmail(null)
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
      <SiteHeader
        variant="login"
        oauthConfigured={oauthConfigured}
        onGithubClick={connectGithub}
      />

      <main className="login-page-main">
        <div className="login-page-shell">
          <div className="login-panel login-panel--auth-card">
            <div className="login-panel-body">
              <div className="login-panel-copy">
                <p className="login-page-eyebrow">Secure access</p>
                <h1 className="login-page-title">Sign in to continue</h1>
                <p className="login-page-lead login-page-lead--in-card">
                  Sign in with <strong>email and password</strong> or <strong>Continue with GitHub</strong> when your deployment
                  enables it. Repo scans connect under <strong>Settings → GitHub</strong> when you use Compliance.
                </p>
              </div>
              <div className="login-panel-divider" aria-hidden="true" />
              <div className="login-panel-fields">
                {error && (
                  <div className="alert alert-error login-alert" role="alert" aria-live="assertive">
                    <AlertTriangle size={18} aria-hidden />
                    <span>{error}</span>
                  </div>
                )}

                {oauthConfigured && (
                  <>
                    <div className="login-actions login-actions--oauth-first">
                      <button
                        type="button"
                        className="btn btn-primary login-btn-full"
                        onClick={connectGithub}
                        disabled={loading}
                      >
                        <Github size={18} strokeWidth={2} aria-hidden />
                        Continue with GitHub
                      </button>
                    </div>
                    <p className="login-auth-divider" role="separator">
                      Or sign in with email
                    </p>
                  </>
                )}

                <form
                  className="login-email-form"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    void signInWithEmail()
                  }}
                >
                  <div className="input-group login-token-field">
                    <label htmlFor="signin-email">Email</label>
                    <input
                      id="signin-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      inputMode="email"
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="input-group login-token-field">
                    <label htmlFor="current-password">Password</label>
                    <div className="login-password-wrap">
                      <input
                        id="current-password"
                        name="password"
                        type={showEmailPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        spellCheck={false}
                        autoCapitalize="none"
                        autoCorrect="off"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-describedby="signin-password-hint"
                      />
                      <button
                        type="button"
                        className="login-password-toggle"
                        onClick={() => setShowEmailPassword((v) => !v)}
                        aria-label={showEmailPassword ? 'Hide password' : 'Show password'}
                        aria-controls="current-password"
                      >
                        {showEmailPassword ? (
                          <EyeOff size={18} strokeWidth={2} aria-hidden />
                        ) : (
                          <Eye size={18} strokeWidth={2} aria-hidden />
                        )}
                      </button>
                    </div>
                    <div id="signin-password-hint" className="login-field-hint login-field-hint--stacked">
                      <Link to="/contact" className="login-forgot-link">
                        Forgot password?
                      </Link>
                      <span className="login-field-hint-sub">A password manager keeps this safer and easier.</span>
                    </div>
                  </div>

                  <div className="login-actions login-actions--single">
                    <button
                      type="submit"
                      className="btn btn-primary login-btn-full"
                      disabled={loading || !email.trim() || !password}
                    >
                      {loading ? <Loader2 size={18} className="spinner" /> : <Mail size={18} aria-hidden />}
                      Sign in
                    </button>
                  </div>
                </form>

                {!oauthConfigured && (
                  <p className="login-oauth-unavailable-hint">
                    GitHub sign-in is not configured here—you can still use email and password. Your admin can enable OAuth for
                    one-click GitHub.
                  </p>
                )}

                {(sessionGithub || sessionEmail) && (
                  <div className="login-session-row">
                    <span className="scanner-session-pill">
                      <CheckCircle2 size={14} />
                      {sessionEmail && (
                        <>
                          Signed in as <strong>{sessionEmail}</strong> (email){sessionGithub ? '; ' : ''}
                        </>
                      )}
                      {sessionGithub && (
                        <>
                          GitHub <strong>{sessionGithub}</strong>
                        </>
                      )}
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void disconnect()}>
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="login-page-footer">
        <p className="login-page-footer-text">
          New to RegTranslate?{' '}
          <Link to={`/signup${location.search || ''}`} className="login-page-footer-link">
            Create access
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
