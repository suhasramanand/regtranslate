import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Github, KeyRound, Loader2, AlertTriangle, CheckCircle2, LogOut } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  GITHUB_OAUTH_API_BASE,
  authLogout,
  authMe,
  authRegister,
  scannerGithubDisconnect,
  scannerGithubSession,
  scannerGithubStatus,
} from './api'
import { getPostAuthRedirectPath } from './authRedirect'
import { dashboardPath } from './dashboardPaths'
import { SiteHeader } from './SiteHeader'
import './App.css'
import './LoginPage.css'
import { validatePasswordClient } from './passwordPolicy'

const SIGNUP_STEPS = [
  {
    title: 'Account',
    body: 'Register with work email and password, or use Continue with GitHub when OAuth is enabled.',
  },
  {
    title: 'GitHub for scans',
    body: 'Add GitHub under Settings when you need Compliance on repos.',
  },
  {
    title: 'Next',
    body: 'Dashboard, scans, or the guided demo without an account.',
  },
] as const

export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = getPostAuthRedirectPath(location)

  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [sessionGithub, setSessionGithub] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [accountPassword2, setAccountPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'form'>('checking')
  const [showPassword, setShowPassword] = useState(false)
  const [showPassword2, setShowPassword2] = useState(false)

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
    document.title = 'Create account · RegTranslate'
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
        'GitHub sign-in isn’t available on this deployment. Ask your administrator to configure GitHub OAuth, or create an account with email and password.',
      )
      return
    }
    setError(null)
    const next = `${window.location.origin}${dashboardPath({ view: 'settings' })}&connected=1`
    window.location.href = `${GITHUB_OAUTH_API_BASE}/auth/github/login?next=` + encodeURIComponent(next)
  }

  const registerWithEmail = async () => {
    const em = accountEmail.trim()
    if (!em || !accountPassword) {
      setError('Enter email and password.')
      return
    }
    if (accountPassword !== accountPassword2) {
      setError('Passwords do not match.')
      return
    }
    const pwErr = validatePasswordClient(accountPassword)
    if (pwErr) {
      setError(pwErr)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await authRegister(em, accountPassword)
      setAccountPassword('')
      setAccountPassword2('')
      await loadSession()
      navigate(fromPath, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const disconnect = async () => {
    setError(null)
    try {
      if (sessionEmail) await authLogout()
    } catch {
      /* continue */
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
          <p className="app-auth-wait-text">Checking your account…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page login-page--signup-flow">
      <SiteHeader
        variant="signup"
        oauthConfigured={oauthConfigured}
        onGithubClick={connectGithub}
      />

      <main className="login-page-main">
        <div className="login-page-shell">
          <div className="login-panel login-panel--signup login-panel--auth-card">
            <div className="login-panel-body">
              <div className="login-panel-copy">
                <p className="login-page-eyebrow">New workspace</p>
                <h1 className="login-page-title">Create your RegTranslate access</h1>
                <p className="login-page-lead login-page-lead--in-card">
                  Use <strong>email and password</strong> below or <strong>Continue with GitHub</strong> when your team enables it.
                  Both use the same workspace.
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
              </div>
              <div className="login-panel-divider" aria-hidden="true" />
              <div className="login-panel-fields">
                {error && (
                  <div className="alert alert-error login-alert" role="alert" aria-live="assertive">
                    <AlertTriangle size={18} aria-hidden />
                    <span>{error}</span>
                  </div>
                )}

                <div className="login-signup-panel-body">
                  {oauthConfigured && (
                    <>
                      <div className="login-actions login-actions--oauth-first">
                        <button type="button" className="btn btn-primary login-btn-full" onClick={connectGithub} disabled={loading}>
                          <Github size={18} strokeWidth={2} aria-hidden />
                          Continue with GitHub
                        </button>
                      </div>
                      <p className="login-auth-divider login-auth-divider--signup" role="separator">
                        Or register with email
                      </p>
                    </>
                  )}

                  <form
                    className="login-register-form login-signup-stack"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault()
                      void registerWithEmail()
                    }}
                  >
                    <div className="input-group login-token-field">
                      <label htmlFor="signup-email">Work email</label>
                      <input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        spellCheck={false}
                        autoCapitalize="none"
                        autoCorrect="off"
                        required
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                      />
                    </div>
                    <div className="input-group login-token-field">
                      <label htmlFor="new-password">Password</label>
                      <div className="login-password-wrap">
                        <input
                          id="new-password"
                          name="new-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          spellCheck={false}
                          autoCapitalize="none"
                          autoCorrect="off"
                          required
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          aria-describedby="signup-password-rules"
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-controls="new-password"
                        >
                          {showPassword ? (
                            <EyeOff size={18} strokeWidth={2} aria-hidden />
                          ) : (
                            <Eye size={18} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      </div>
                      <p id="signup-password-rules" className="login-field-hint login-field-hint--signup">
                        12+ characters · upper and lower case · number · symbol
                      </p>
                    </div>
                    <div className="input-group login-token-field">
                      <label htmlFor="signup-password-confirm">Confirm password</label>
                      <div className="login-password-wrap">
                        <input
                          id="signup-password-confirm"
                          name="new-password-confirm"
                          type={showPassword2 ? 'text' : 'password'}
                          autoComplete="new-password"
                          spellCheck={false}
                          autoCapitalize="none"
                          autoCorrect="off"
                          required
                          value={accountPassword2}
                          onChange={(e) => setAccountPassword2(e.target.value)}
                          aria-describedby="signup-password-confirm-hint"
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() => setShowPassword2((v) => !v)}
                          aria-label={showPassword2 ? 'Hide password' : 'Show password'}
                          aria-controls="signup-password-confirm"
                        >
                          {showPassword2 ? (
                            <EyeOff size={18} strokeWidth={2} aria-hidden />
                          ) : (
                            <Eye size={18} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      </div>
                      <p id="signup-password-confirm-hint" className="login-field-hint login-field-hint--signup">
                        Must match the password you entered above.
                      </p>
                    </div>
                    <div className="login-actions login-actions--single login-actions--signup-submit">
                      <button
                        type="submit"
                        className="btn btn-primary login-btn-full"
                        disabled={loading || !accountEmail.trim() || !accountPassword || !accountPassword2}
                      >
                        {loading ? <Loader2 size={18} className="spinner" /> : <KeyRound size={18} aria-hidden />}
                        Create account
                      </button>
                    </div>
                  </form>

                  {!oauthConfigured && (
                    <p className="login-oauth-unavailable-hint">
                      GitHub sign-in is not configured here—you can still register with email. Your admin can enable OAuth for
                      one-click GitHub.
                    </p>
                  )}
                </div>

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
          Already have access?{' '}
          <Link to={`/login${location.search || ''}`} className="login-page-footer-link">
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
