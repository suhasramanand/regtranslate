import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Github, KeyRound, Loader2, LogOut } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  GITHUB_OAUTH_API_BASE,
  scannerGithubDisconnect,
  scannerGithubPatLogin,
  scannerGithubSession,
  scannerGithubStatus,
} from './api'
import { dashboardPath } from './dashboardPaths'
import './ScannerPage.css'

/**
 * GitHub OAuth / PAT for RegTranslate: secures the whole app (PDF workflow data + repository scans).
 * OAuth/PAT hit the GitHub OAuth service (`/oauth` proxy → port 9020); same `scanner_sid` is sent site-wide in dev.
 */
export function ComplianceScannerGithubSettings({ isDemoMode }: { isDemoMode: boolean }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [sessionLogin, setSessionLogin] = useState<string | null>(null)
  const [patPanelOpen, setPatPanelOpen] = useState(false)
  const [pat, setPat] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const loadSession = useCallback(async () => {
    if (isDemoMode) return
    try {
      const [st, sess] = await Promise.all([scannerGithubStatus(), scannerGithubSession()])
      setOauthConfigured(st.oauth_configured)
      setSessionLogin(sess.connected && sess.login ? sess.login : null)
    } catch {
      setOauthConfigured(false)
      setSessionLogin(null)
    }
  }, [isDemoMode])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    if (searchParams.get('connected') !== '1') return
    setNotice({ kind: 'ok', text: 'GitHub connected. Your documents, tasks, and scans stay on this account.' })
    const p = new URLSearchParams(searchParams)
    p.delete('connected')
    setSearchParams(p, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#compliance-scanner-github') return
    requestAnimationFrame(() => {
      document.getElementById('compliance-scanner-github')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    })
  }, [])

  const settingsPath = dashboardPath({ view: 'settings', demo: isDemoMode })
  const oauthReturnUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${settingsPath}&connected=1`

  const connectGithub = () => {
    if (isDemoMode) return
    if (!oauthConfigured) {
      setNotice({
        kind: 'err',
        text: 'One-click GitHub sign-in isn’t enabled for this deployment. Use “Sign in with credential” below.',
      })
      return
    }
    setNotice(null)
    window.location.href = `${GITHUB_OAUTH_API_BASE}/auth/github/login?next=` + encodeURIComponent(oauthReturnUrl)
  }

  const signInWithPat = async () => {
    if (isDemoMode) return
    const t = pat.trim()
    if (!t) {
      setNotice({ kind: 'err', text: 'Enter your GitHub credential first.' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const res = await scannerGithubPatLogin(t)
      setNotice({ kind: 'ok', text: `Signed in as ${res.login}.` })
      setPat('')
      await loadSession()
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Token sign-in failed' })
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (isDemoMode) return
    setNotice(null)
    try {
      await scannerGithubDisconnect()
      navigate('/login', { replace: true })
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Disconnect failed' })
    }
  }

  if (isDemoMode) {
    return (
      <div className="card settings-scanner-github-card" id="compliance-scanner-github">
        <h3 className="settings-card-title">
          <Github size={18} aria-hidden />
          GitHub sign-in
        </h3>
        <p className="settings-card-desc">The guided demo skips account sign-in. Use the full app so your data is tied to your GitHub user.</p>
      </div>
    )
  }

  return (
    <div className="card settings-scanner-github-card" id="compliance-scanner-github">
      <h3 className="settings-card-title">
        <Github size={18} aria-hidden />
        GitHub sign-in (RegTranslate)
      </h3>
      <p className="settings-card-desc">
        Required for the PDF workflow and Compliance Scanner. Your uploads, tasks, export history, and scans are stored per GitHub
        account. Scopes: <code>repo</code>, <code>read:org</code>.
      </p>

      {notice && (
        <div className={notice.kind === 'ok' ? 'alert alert-success' : 'alert alert-error'} style={{ marginBottom: 'var(--space-4)' }}>
          {notice.kind === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="scanner-connect-embed">
        <div className="scanner-connect-hero">
          <div className="scanner-connect-icon" aria-hidden>
            <Github size={36} strokeWidth={2} />
          </div>
          <h2 className="scanner-connect-title">GitHub access</h2>
          <p className="scanner-connect-sub">
            This session also protects your RegTranslate API data (separate from the Jira / export credential below).
          </p>
        </div>

        <div className="scanner-connect-cards">
          <button type="button" className="scanner-connect-card scanner-connect-card--primary" onClick={connectGithub} disabled={busy}>
            <span className="scanner-connect-card-icon">
              <Github size={22} />
            </span>
            <span className="scanner-connect-card-body">
              <span className="scanner-connect-card-title">Sign in with GitHub OAuth</span>
              <span className="scanner-connect-card-desc">Recommended — secure, scoped access</span>
            </span>
            <ArrowRight className="scanner-connect-card-arrow" size={20} aria-hidden />
          </button>
          <button
            type="button"
            className={`scanner-connect-card${patPanelOpen ? ' scanner-connect-card--open' : ''}`}
            onClick={() => setPatPanelOpen((v) => !v)}
          >
            <span className="scanner-connect-card-icon">
              <KeyRound size={22} />
            </span>
            <span className="scanner-connect-card-body">
              <span className="scanner-connect-card-title">Use Personal Access Token</span>
              <span className="scanner-connect-card-desc">Fallback — paste a fine-grained PAT</span>
            </span>
            <ArrowRight className="scanner-connect-card-arrow" size={20} aria-hidden />
          </button>
        </div>

        {sessionLogin && (
          <div className="scanner-session-banner">
            <CheckCircle2 size={18} className="scanner-session-banner-icon" />
            <span>
              Signed in as <strong>{sessionLogin}</strong>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void disconnect()}>
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        )}

        {patPanelOpen && (
          <div className="scanner-pat-panel card">
            <div className="input-group">
              <label htmlFor="settings-scanner-pat">GitHub credential</label>
              <input
                id="settings-scanner-pat"
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="Paste PAT, then sign in"
                autoComplete="off"
              />
            </div>
            <div className="scanner-actions github-connect-row github-connect-row--compact">
              <button type="button" className={oauthConfigured ? 'btn btn-secondary' : 'btn btn-primary'} onClick={() => void signInWithPat()} disabled={busy || !pat.trim()}>
                {busy ? <Loader2 size={16} className="spinner" /> : <Github size={16} />}
                Sign in with credential
              </button>
            </div>
            {!oauthConfigured && (
              <details className="scanner-oauth-details">
                <summary>Can’t use GitHub in the browser?</summary>
                <span className="scanner-connect-hint">
                  Your administrator can turn on one-click GitHub for RegTranslate Compliance. You can always use{' '}
                  <strong>Sign in with credential</strong> here.
                </span>
              </details>
            )}
          </div>
        )}

        <p className="scanner-scopes-hint">
          <ExternalLink size={14} aria-hidden />
          <span>
            Scopes needed: <code>repo</code>, <code>read:org</code>
          </span>
        </p>
      </div>
    </div>
  )
}
