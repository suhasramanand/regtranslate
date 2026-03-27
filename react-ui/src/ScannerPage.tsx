import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText,
  Loader2,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Send,
  Moon,
  Sun,
  Github,
  LogOut,
  Search,
} from 'lucide-react'
import {
  SCANNER_API_BASE,
  scannerExportToJira,
  scannerGetFindings,
  scannerGetRun,
  scannerGithubDisconnect,
  scannerGithubOrgRepos,
  scannerGithubOrgs,
  scannerGithubPatLogin,
  scannerGithubSession,
  scannerGithubStatus,
  scannerStartOrgScan,
  type ScannerFinding,
  type ScannerRun,
} from './api'
import { useTheme } from './useTheme'
import './App.css'
import './ScannerPage.css'

type RepoRow = { full_name: string; default_branch: string; private: boolean; description: string }

export function ScannerPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [sessionLogin, setSessionLogin] = useState<string | null>(null)

  const [org, setOrg] = useState('')
  const [orgs, setOrgs] = useState<string[]>([])
  const [token, setToken] = useState('')
  const [repoList, setRepoList] = useState<RepoRow[]>([])
  const [repoFilter, setRepoFilter] = useState('')
  const [selectedNames, setSelectedNames] = useState<Set<string>>(() => new Set())
  const [scanAllOrg, setScanAllOrg] = useState(false)

  const [runId, setRunId] = useState('')
  const [run, setRun] = useState<ScannerRun | null>(null)
  const [findings, setFindings] = useState<ScannerFinding[]>([])
  const [loading, setLoading] = useState<false | 'start' | 'refresh' | 'jira' | 'repos' | 'orgs' | 'pat'>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [jiraProject, setJiraProject] = useState('')
  const [jiraUrl, setJiraUrl] = useState('https://your-domain.atlassian.net')
  const [jiraEmail, setJiraEmail] = useState('')
  const [jiraToken, setJiraToken] = useState('')

  const canRefresh = !!runId
  const isRunning = run?.status === 'queued' || run?.status === 'running'
  const nonCompliant = useMemo(() => findings.filter((f) => f.status === 'non_compliant'), [findings])
  const filteredRepos = useMemo(() => {
    const q = repoFilter.trim().toLowerCase()
    if (!q) return repoList
    return repoList.filter((r) => r.full_name.toLowerCase().includes(q))
  }, [repoList, repoFilter])

  const loadSession = useCallback(async () => {
    try {
      const [st, sess] = await Promise.all([scannerGithubStatus(), scannerGithubSession()])
      setOauthConfigured(st.oauth_configured)
      setSessionLogin(sess.connected && sess.login ? sess.login : null)
    } catch {
      setOauthConfigured(false)
      setSessionLogin(null)
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    if (searchParams.get('connected') !== '1') return
    setSuccess('GitHub connected. You can load organizations and repositories.')
    const p = new URLSearchParams(searchParams)
    p.delete('connected')
    setSearchParams(p, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (searchParams.get('signin') !== '1') return
    requestAnimationFrame(() => {
      document.getElementById('scanner-signin')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    const p = new URLSearchParams(searchParams)
    p.delete('signin')
    setSearchParams(p, { replace: true })
  }, [searchParams, setSearchParams])

  const refresh = useCallback(
    async (targetRunId = runId) => {
      if (!targetRunId) return
      setLoading('refresh')
      setError(null)
      try {
        const [r, f] = await Promise.all([scannerGetRun(targetRunId), scannerGetFindings(targetRunId)])
        setRun(r)
        setFindings(f.findings || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to refresh run')
      } finally {
        setLoading(false)
      }
    },
    [runId],
  )

  useEffect(() => {
    if (!isRunning || !runId) return
    const iv = setInterval(() => {
      refresh(runId).catch(() => {})
    }, 5000)
    return () => clearInterval(iv)
  }, [isRunning, runId, refresh])

  const connectGithub = () => {
    if (!oauthConfigured) {
      setError(
        'One-click GitHub sign-in isn’t enabled for this deployment. Use “Sign in with credential” below.',
      )
      setSuccess(null)
      return
    }
    setError(null)
    const next = `${window.location.origin}/scanner/app?connected=1`
    window.location.href =
      `${SCANNER_API_BASE}/auth/github/login?next=` + encodeURIComponent(next)
  }

  const signInWithToken = async () => {
    const t = token.trim()
    if (!t) {
      setError('Enter your GitHub credential first.')
      return
    }
    setLoading('pat')
    setError(null)
    setSuccess(null)
    try {
      const res = await scannerGithubPatLogin(t)
      setSuccess(`Signed in as ${res.login}. You’re ready to scan.`)
      await loadSession()
      setToken('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Token sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const disconnectGithub = async () => {
    setError(null)
    try {
      await scannerGithubDisconnect()
      setSessionLogin(null)
      setOrgs([])
      setRepoList([])
      setSelectedNames(new Set())
      navigate('/login', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed')
    }
  }

  const loadOrgs = async () => {
    setLoading('orgs')
    setError(null)
    try {
      const { orgs: list } = await scannerGithubOrgs(token.trim() || null)
      setOrgs(list)
      if (list.length && !org.trim()) setOrg(list[0])
      setSuccess(`Loaded ${list.length} organization(s)`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  const loadRepos = async () => {
    if (!org.trim()) {
      setError('Choose or enter an organization first.')
      return
    }
    setLoading('repos')
    setError(null)
    try {
      const { repos } = await scannerGithubOrgRepos(org.trim(), { limit: 200, githubToken: token.trim() || null })
      setRepoList(repos)
      setSelectedNames(new Set())
      setSuccess(`Loaded ${repos.length} repositories`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }

  const toggleRepo = (name: string) => {
    setScanAllOrg(false)
    setSelectedNames((prev) => {
      const n = new Set(prev)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })
  }

  const selectVisible = () => {
    setScanAllOrg(false)
    setSelectedNames((prev) => {
      const n = new Set(prev)
      for (const r of filteredRepos) n.add(r.full_name)
      return n
    })
  }

  const clearSelection = () => {
    setSelectedNames(new Set())
  }

  const startScan = async () => {
    if (!org.trim()) {
      setError('Organization is required.')
      return
    }
    if (!scanAllOrg && selectedNames.size === 0) {
      setError('Select at least one repository, or enable “Scan all repositories in this org”.')
      return
    }
    setLoading('start')
    setError(null)
    setSuccess(null)
    setFindings([])
    setRun(null)
    try {
      const selected_repos =
        scanAllOrg || selectedNames.size === 0
          ? null
          : repoList
              .filter((r) => selectedNames.has(r.full_name))
              .map((r) => ({ full_name: r.full_name, default_branch: r.default_branch }))

      const res = await scannerStartOrgScan({
        org: org.trim(),
        repos: null,
        selected_repos,
        github_token: token.trim() || null,
        scan_all_org: scanAllOrg,
      })
      setRunId(res.run_id)
      await refresh(res.run_id)
      setSuccess(`Scan started: ${res.run_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start scan')
    } finally {
      setLoading(false)
    }
  }

  const exportJira = async () => {
    if (!runId || !jiraProject.trim()) {
      setError('Run ID and Jira project key are required.')
      return
    }
    setLoading('jira')
    setError(null)
    setSuccess(null)
    try {
      const res = await scannerExportToJira({
        run_id: runId,
        project_key: jiraProject.trim(),
        url: jiraUrl || null,
        email: jiraEmail || null,
        api_token: jiraToken || null,
        only_non_compliant: true,
      })
      setSuccess(res.keys.length ? `Created: ${res.keys.join(', ')}` : 'No non-compliant findings to export.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export findings to Jira')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="mobile-header">
        <Link to="/dashboard" className="mobile-header-brand">
          <FileText size={22} strokeWidth={2} />
          RegTranslate
        </Link>
      </header>

      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/dashboard" title="RegTranslate">
            <FileText size={24} strokeWidth={2} />
          </Link>
        </div>
        <nav className="sidebar-nav">
          <Link to="/dashboard" title="Dashboard">
            <ShieldCheck size={20} />
          </Link>
          <Link to="/scanner/app" className="active" title="Compliance Scanner app">
            <AlertTriangle size={20} />
          </Link>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </aside>

      <main className="main">
        <div className="main-inner scanner-main">
          <header className="main-header main-header-split scanner-main-header">
            <div className="scanner-main-header-text">
              <h1>Compliance Scanner</h1>
              <p>Pick repositories, run scans, export gaps to Jira</p>
            </div>
            <button
              type="button"
              className={`scanner-header-github${oauthConfigured ? ' scanner-header-github--active' : ''}`}
              onClick={connectGithub}
              aria-label="Sign in with GitHub in the browser"
              title={
                oauthConfigured
                  ? 'Sign in with GitHub in the browser'
                  : 'Use “Sign in with credential” in the card below'
              }
            >
              <Github size={18} strokeWidth={2} aria-hidden />
            </button>
          </header>

          {error && (
            <div className="alert alert-error">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          <section id="scanner-signin" className="step">
            <div className="step-header compact">
              <span className="step-number">0</span>
              <h2 className="step-title">GitHub</h2>
            </div>
            <div className="card">
              <p className="scanner-muted scanner-github-hint">
                Use the <strong>GitHub</strong> icon next to the title for one-click sign-in when it’s available, or paste
                a GitHub credential below to connect securely.
              </p>
              <div className="input-group">
                <label>GitHub credential (optional)</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Optional — applied when you sign in below"
                />
                <span className="scanner-hint">
                  Use for this session until you sign in; your credential is stored securely after sign-in.
                </span>
              </div>
              <div className="scanner-actions github-connect-row github-connect-row--compact">
                <button
                  type="button"
                  className={oauthConfigured ? 'btn btn-secondary' : 'btn btn-primary'}
                  onClick={() => signInWithToken()}
                  disabled={!!loading || !token.trim()}
                >
                  {loading === 'pat' ? <Loader2 size={16} className="spinner" /> : <Github size={16} />}
                  Sign in with credential
                </button>
                {sessionLogin && (
                  <span className="scanner-session-pill">
                    <CheckCircle2 size={14} />
                    Signed in as <strong>{sessionLogin}</strong>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={disconnectGithub}>
                      <LogOut size={14} />
                      Disconnect
                    </button>
                  </span>
                )}
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
              <div className="card-actions scanner-actions">
                <button type="button" className="btn btn-secondary" onClick={loadOrgs} disabled={!!loading}>
                  {loading === 'orgs' ? <Loader2 size={16} className="spinner" /> : <Github size={16} />}
                  Load my organizations
                </button>
              </div>
              <div className="input-group">
                <label htmlFor="scanner-org">Organization</label>
                <input
                  id="scanner-org"
                  name="organization"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  placeholder="my-org"
                  list={orgs.length > 0 ? 'scanner-org-suggestions' : undefined}
                  autoComplete="off"
                />
                {orgs.length > 0 && (
                  <datalist id="scanner-org-suggestions">
                    {orgs.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
                <span className="scanner-hint">
                  {orgs.length > 0
                    ? 'Choose from suggestions or type an org login you can access.'
                    : 'Load organizations first for suggestions, or enter the org login manually.'}
                </span>
              </div>
            </div>
          </section>

          <section className="step">
            <div className="step-header compact">
              <span className="step-number">1</span>
              <h2 className="step-title">Choose repositories</h2>
            </div>
            <div className="card">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={scanAllOrg}
                  onChange={(e) => {
                    setScanAllOrg(e.target.checked)
                    if (e.target.checked) setSelectedNames(new Set())
                  }}
                />
                Scan all repositories in this org (may take a long time)
              </label>
              <div className="scanner-actions">
                <button type="button" className="btn btn-secondary" onClick={loadRepos} disabled={!!loading || !org.trim()}>
                  {loading === 'repos' ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />}
                  Load repositories
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={selectVisible} disabled={scanAllOrg || !filteredRepos.length}>
                  Select visible
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={scanAllOrg}>
                  Clear selection
                </button>
              </div>
              {!scanAllOrg && repoList.length > 0 && (
                <>
                  <div className="scanner-repo-search">
                    <Search size={16} />
                    <input
                      type="search"
                      placeholder="Filter repositories…"
                      value={repoFilter}
                      onChange={(e) => setRepoFilter(e.target.value)}
                    />
                  </div>
                  <div className="scanner-repo-grid">
                    {filteredRepos.map((r) => (
                      <label key={r.full_name} className="scanner-repo-tile">
                        <input
                          type="checkbox"
                          checked={selectedNames.has(r.full_name)}
                          onChange={() => toggleRepo(r.full_name)}
                        />
                        <span className="scanner-repo-name">{r.full_name}</span>
                        <span className="scanner-repo-meta">
                          {r.default_branch}
                          {r.private ? ' · private' : ''}
                        </span>
                        {r.description && <span className="scanner-repo-desc">{r.description}</span>}
                      </label>
                    ))}
                  </div>
                  <p className="scanner-hint">{selectedNames.size} selected · {repoList.length} loaded</p>
                </>
              )}
            </div>
          </section>

          <section className="step">
            <div className="step-header compact">
              <span className="step-number">2</span>
              <h2 className="step-title">Run scan</h2>
            </div>
            <div className="card">
              <div className="card-actions scanner-actions">
                <button className="btn btn-primary" onClick={startScan} disabled={!!loading}>
                  {loading === 'start' ? <Loader2 size={16} className="spinner" /> : <Play size={16} />}
                  Start org scan
                </button>
                <button className="btn btn-secondary" onClick={() => refresh()} disabled={!canRefresh || !!loading}>
                  {loading === 'refresh' ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />}
                  Refresh
                </button>
              </div>
            </div>
          </section>

          <section className="step">
            <div className="step-header compact">
              <span className="step-number">3</span>
              <h2 className="step-title">Run status</h2>
            </div>
            <div className="card scanner-stats-card">
              <div className="scanner-kv">
                <strong>Run ID:</strong> <code>{runId || '—'}</code>
              </div>
              <div className="scanner-kv">
                <strong>Status:</strong>{' '}
                <span className={`scanner-status scanner-status-${run?.status || 'none'}`}>{run?.status || 'not started'}</span>
              </div>
              <div className="scanner-stats-grid">
                <div>
                  <span>Repos</span>
                  <strong>
                    {run?.counts?.repos_done ?? 0}/{run?.counts?.repos_total ?? 0}
                  </strong>
                </div>
                <div>
                  <span>Files indexed</span>
                  <strong>{run?.counts?.files_indexed ?? 0}</strong>
                </div>
                <div>
                  <span>Chunks indexed</span>
                  <strong>{run?.counts?.chunks_indexed ?? 0}</strong>
                </div>
                <div>
                  <span>Findings</span>
                  <strong>{run?.counts?.findings_total ?? 0}</strong>
                </div>
                <div>
                  <span>Non-compliant</span>
                  <strong>{run?.counts?.findings_non_compliant ?? 0}</strong>
                </div>
                <div>
                  <span>Unknown</span>
                  <strong>{run?.counts?.findings_unknown ?? 0}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="step">
            <div className="step-header compact">
              <span className="step-number">4</span>
              <h2 className="step-title">Findings</h2>
            </div>
            <div className="card">
              {!findings.length ? (
                <p className="scanner-empty">No findings yet. Start a scan and refresh to load results.</p>
              ) : (
                <div className="scanner-findings-list">
                  {findings.map((f, i) => (
                    <div key={`${f.control_id}-${i}`} className={`scanner-finding scanner-finding-${f.status}`}>
                      <div className="scanner-finding-head">
                        <strong>{f.control_id}</strong>
                        <span className={`scanner-chip scanner-chip-${f.status}`}>{f.status}</span>
                      </div>
                      <div className="scanner-finding-title">{f.control_title}</div>
                      <p className="scanner-finding-text">{f.gap_description || f.summary || 'No details provided.'}</p>
                      {(f.evidence_links || []).length > 0 && (
                        <div className="scanner-evidence-links">
                          {(f.evidence_links || []).slice(0, 3).map((e, idx) => (
                            <a key={idx} href={e.url} target="_blank" rel="noopener noreferrer">
                              {e.label || 'Evidence link'}
                              <ExternalLink size={12} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="step">
            <div className="step-header compact">
              <span className="step-number">5</span>
              <h2 className="step-title">Export to Jira</h2>
            </div>
            <div className="card">
              <div className="input-group">
                <label>Project key</label>
                <input value={jiraProject} onChange={(e) => setJiraProject(e.target.value)} placeholder="PROJ" />
              </div>
              <div className="input-group">
                <label>Jira URL (optional)</label>
                <input value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Email (optional)</label>
                <input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div className="input-group">
                <label>Jira credential (optional)</label>
                <input
                  type="password"
                  value={jiraToken}
                  onChange={(e) => setJiraToken(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="card-actions scanner-actions">
                <button
                  className="btn btn-primary"
                  onClick={exportJira}
                  disabled={!!loading || !runId || nonCompliant.length === 0}
                >
                  {loading === 'jira' ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
                  Export non-compliant findings ({nonCompliant.length})
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
