import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText,
  FileCode,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ScanLine,
  ExternalLink,
  Moon,
  Sun,
  Github,
  Search,
  History,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  Globe,
  ArrowRight,
  HelpCircle,
  XCircle,
  Lock,
} from 'lucide-react'
import {
  getExportConfig,
  scannerExportToJira,
  scannerGetFindings,
  scannerGetRun,
  scannerGithubOrgRepos,
  scannerGithubOrgs,
  scannerGithubUserRepos,
  scannerGithubSession,
  scannerStartOrgScan,
  type ScannerFinding,
  type ScannerRun,
} from './api'
import { readJiraExportPrefs } from './jiraExportPrefs'
import { useTheme } from './useTheme'
import { Tooltip } from './Tooltip'
import { dashboardPath } from './dashboardPaths'
import './App.css'
import './ScannerPage.css'

type RepoRow = { full_name: string; default_branch: string; private: boolean; description: string }

function severityBadge(f: ScannerFinding): 'low' | 'medium' | 'high' | 'critical' {
  if (f.status === 'compliant') return 'low'
  if (f.status === 'unknown') return 'medium'
  const c = f.confidence ?? 0.5
  if (c >= 0.85) return 'critical'
  if (c >= 0.65) return 'high'
  if (c >= 0.35) return 'medium'
  return 'low'
}

export function ScannerPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [sessionLogin, setSessionLogin] = useState<string | null>(null)

  const [org, setOrg] = useState('')
  const [orgs, setOrgs] = useState<string[]>([])
  const [repoList, setRepoList] = useState<RepoRow[]>([])
  const [repoFilter, setRepoFilter] = useState('')
  const [selectedNames, setSelectedNames] = useState<Set<string>>(() => new Set())
  const [scanAllOrg, setScanAllOrg] = useState(false)

  const [runId, setRunId] = useState('')
  const [run, setRun] = useState<ScannerRun | null>(null)
  const [findings, setFindings] = useState<ScannerFinding[]>([])
  const [loading, setLoading] = useState<
    false | 'start' | 'refresh' | 'jira' | 'repos' | 'user_repos' | 'orgs'
  >(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [findingsQuery, setFindingsQuery] = useState('')
  const [expandedFindingKey, setExpandedFindingKey] = useState<string | null>(null)
  const [orgRepoCounts, setOrgRepoCounts] = useState<Record<string, number>>({})
  /** Wizard step: 1 Select repos → 2 Scan → 3 Results (GitHub sign-in is in Dashboard Settings). */
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1)
  /** Re-run repos auto-load when returning to step 1 after visiting later steps. */
  const reposAutoLoadPendingRef = useRef(true)

  const canRefresh = !!runId
  const isRunning = run?.status === 'queued' || run?.status === 'running'
  const nonCompliant = useMemo(() => findings.filter((f) => f.status === 'non_compliant'), [findings])

  const findingsFiltered = useMemo(() => {
    const q = findingsQuery.trim().toLowerCase()
    if (!q) return findings
    return findings.filter((f) => {
      const hay = [f.control_id, f.control_title, f.summary, f.gap_description].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [findings, findingsQuery])

  const findingStats = useMemo(() => {
    const passed = findings.filter((f) => f.status === 'compliant').length
    const failed = findings.filter((f) => f.status === 'non_compliant').length
    const unknown = findings.filter((f) => f.status === 'unknown').length
    const total = findings.length
    const rate = total ? Math.round((passed / total) * 100) : 0
    return { passed, failed, unknown, total, rate }
  }, [findings])

  const scanProgressPct = useMemo(() => {
    const t = run?.counts?.repos_total ?? 0
    const d = run?.counts?.repos_done ?? 0
    if (!t) return run?.status === 'completed' ? 100 : 0
    return Math.min(100, Math.round((d / t) * 100))
  }, [run])

  const filteredRepos = useMemo(() => {
    const q = repoFilter.trim().toLowerCase()
    if (!q) return repoList
    return repoList.filter((r) => r.full_name.toLowerCase().includes(q))
  }, [repoList, repoFilter])

  const loadSession = useCallback(async () => {
    try {
      const sess = await scannerGithubSession()
      const login = sess.connected && sess.login ? sess.login : null
      setSessionLogin(login)
    } catch {
      setSessionLogin(null)
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    if (searchParams.get('connected') !== '1') return
    navigate(`${dashboardPath({ view: 'settings' })}&connected=1`, { replace: true })
  }, [searchParams, navigate])

  useEffect(() => {
    if (searchParams.get('signin') !== '1') return
    navigate(`${dashboardPath({ view: 'settings' })}#compliance-scanner-github`, { replace: true })
  }, [searchParams, navigate])

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

  useEffect(() => {
    if (flowStep === 2 && !runId) setFlowStep(1)
  }, [flowStep, runId])

  const loadOrgs = async () => {
    setLoading('orgs')
    setError(null)
    try {
      const { orgs: list } = await scannerGithubOrgs(null)
      setOrgs(list)
      if (list.length && !org.trim()) setOrg(list[0])
      setSuccess(`Loaded ${list.length} organization(s)`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  const loadRepos = async (orgOverride?: string) => {
    const target = (orgOverride ?? org).trim()
    if (!target) {
      setError('Choose or enter an organization (or your GitHub username) first.')
      return
    }
    if (orgOverride !== undefined) setOrg(orgOverride)
    setLoading('repos')
    setError(null)
    try {
      const { repos } = await scannerGithubOrgRepos(target, { limit: 200, githubToken: null })
      setRepoList(repos)
      setSelectedNames(new Set())
      setOrgRepoCounts((prev) => ({ ...prev, [target]: repos.length }))
      setSuccess(`Loaded ${repos.length} repositories`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }

  /** Personal repos (no GitHub org required). Uses the signed-in user or the credential in the field. */
  const loadMyUserRepos = async () => {
    if (!sessionLogin) {
      setError('Sign in to GitHub under Settings, then return here.')
      return
    }
    setLoading('user_repos')
    setError(null)
    try {
      const { login, repos } = await scannerGithubUserRepos({
        limit: 200,
        githubToken: null,
      })
      setOrg(login)
      setRepoList(repos)
      setSelectedNames(new Set())
      setOrgRepoCounts((prev) => ({ ...prev, [login]: repos.length }))
      setSuccess(`Loaded ${repos.length} personal repositories for ${login}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your repositories')
    } finally {
      setLoading(false)
    }
  }

  /** Load org list and personal repos automatically on step 1. Uses allSettled so one failure still leaves partial data. */
  const bootstrapStep2Data = useCallback(async () => {
    setLoading('repos')
    setError(null)
    try {
      const [orgsResult, userResult] = await Promise.allSettled([
        scannerGithubOrgs(null),
        scannerGithubUserRepos({ limit: 200, githubToken: null }),
      ])

      let orgCount = 0
      if (orgsResult.status === 'fulfilled') {
        const list = orgsResult.value.orgs
        orgCount = list.length
        setOrgs(list)
      }

      if (userResult.status === 'fulfilled') {
        const { login, repos } = userResult.value
        setOrgRepoCounts((prev) => ({ ...prev, [login]: repos.length }))
        setOrg(login)
        setRepoList(repos)
        setSelectedNames(new Set())
        setSuccess(
          orgCount > 0
            ? `Loaded ${orgCount} organization(s) and ${repos.length} personal repositories.`
            : `Loaded ${repos.length} personal repositories.`,
        )
      } else if (orgsResult.status === 'fulfilled' && orgsResult.value.orgs.length > 0) {
        const first = orgsResult.value.orgs[0]
        setOrg(first)
        setRepoList([])
        setSelectedNames(new Set())
        setSuccess(`Loaded ${orgsResult.value.orgs.length} organization(s). Use Load repositories or an org tab.`)
      }

      const gotUserRepos = userResult.status === 'fulfilled'
      const gotOrgFallback = orgsResult.status === 'fulfilled' && orgsResult.value.orgs.length > 0
      if (!gotUserRepos && !gotOrgFallback) {
        const parts: string[] = []
        if (orgsResult.status === 'rejected') {
          parts.push(orgsResult.reason instanceof Error ? orgsResult.reason.message : 'Failed to load organizations')
        }
        if (userResult.status === 'rejected') {
          parts.push(userResult.reason instanceof Error ? userResult.reason.message : 'Failed to load your repositories')
        }
        if (parts.length > 0) setError(parts.join(' '))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (flowStep !== 1) {
      reposAutoLoadPendingRef.current = true
      return
    }
    if (!sessionLogin) return
    if (!reposAutoLoadPendingRef.current) return
    reposAutoLoadPendingRef.current = false
    void bootstrapStep2Data()
  }, [flowStep, sessionLogin, bootstrapStep2Data])

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
      setError('Enter an organization or your GitHub username (or use “Load my repositories”).')
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
        github_token: null,
        scan_all_org: scanAllOrg,
      })
      setRunId(res.run_id)
      await refresh(res.run_id)
      setFlowStep(2)
      setSuccess(`Scan started: ${res.run_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start scan')
    } finally {
      setLoading(false)
    }
  }

  const exportJira = async () => {
    if (!runId) {
      setError('No active scan run to export.')
      return
    }
    const prefs = readJiraExportPrefs()
    const project = prefs.project?.trim()
    if (!project) {
      setError('Set your Jira project key in Settings before exporting.')
      return
    }
    setLoading('jira')
    setError(null)
    setSuccess(null)
    try {
      let url: string | null = prefs.url?.trim() || null
      let email: string | null = prefs.email?.trim() || null
      let api_token: string | null = prefs.token?.trim() || null
      try {
        const cfg = await getExportConfig()
        if (!url && cfg.jira.url) url = cfg.jira.url
        if (!email && cfg.jira.email) email = cfg.jira.email
        if (!api_token && cfg.jira.api_token) api_token = cfg.jira.api_token
      } catch {
        /* use browser-stored prefs only */
      }
      const res = await scannerExportToJira({
        run_id: runId,
        project_key: project,
        url,
        email,
        api_token,
        only_non_compliant: true,
      })
      setSuccess(res.keys.length ? `Created: ${res.keys.join(', ')}` : 'No non-compliant findings to export.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export findings to Jira')
    } finally {
      setLoading(false)
    }
  }

  const newScan = () => {
    setRunId('')
    setRun(null)
    setFindings([])
    setSuccess(null)
    setError(null)
    setFlowStep(1)
  }

  const activeOrgTab = sessionLogin && org === sessionLogin ? 'my' : org.trim() || ''

  return (
    <div className="app">
      <header className="mobile-header">
        <Link to={dashboardPath()} className="mobile-header-brand">
          <FileText size={22} strokeWidth={2} />
          RegTranslate
        </Link>
      </header>

      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to={dashboardPath()} title="RegTranslate">
            <FileText size={24} strokeWidth={2} />
          </Link>
        </div>
        <nav className="sidebar-nav">
          <Tooltip content="PDF → Jira / GitHub" side="right">
            <Link to={dashboardPath()} title="PDF workflow">
              <FileCode size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="Compliance Scanner" side="right">
            <Link to="/scanner/app" className="active" title="Compliance Scanner">
              <ScanLine size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="History" side="right">
            <Link to={dashboardPath({ view: 'history' })} title="Export history">
              <History size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="Audit trail" side="right">
            <Link to={dashboardPath({ view: 'audit' })} title="Audit trail">
              <ShieldCheck size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="Settings" side="right">
            <Link to={dashboardPath({ view: 'settings' })} title="Settings">
              <Settings size={20} />
            </Link>
          </Tooltip>
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
          <header className="workspace-header scanner-page-header scanner-page-header--revamp">
            <div className="workspace-header-main">
              <span className="workspace-eyebrow">Compliance Scanner</span>
              <h1>Repository scans</h1>
              <p className="scanner-page-lead">
                Run controls on GitHub code, review findings, and export gaps to Jira in a guided flow.
              </p>
            </div>
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

          <nav className="scanner-stepper" aria-label="Scan progress">
            {[
              { n: 1, label: 'Select repos' },
              { n: 2, label: 'Scan' },
              { n: 3, label: 'Results' },
            ].map((s, i) => (
              <Fragment key={s.n}>
                {i > 0 && <ChevronRight className="scanner-stepper-chevron" size={16} aria-hidden />}
                <div
                  className={`scanner-step${flowStep === s.n ? ' scanner-step--active' : ''}${
                    flowStep > s.n ? ' scanner-step--done' : ''
                  }`}
                >
                  <span className="scanner-step-pill">{s.label}</span>
                </div>
              </Fragment>
            ))}
          </nav>

          <div className="scanner-wizard-stage" aria-live="polite">
          {flowStep === 1 && (
          <section className="scanner-panel scanner-panel--repos">
            {!sessionLogin && (
              <div className="alert alert-error" style={{ maxWidth: 920, margin: '0 auto var(--space-4)' }}>
                <AlertTriangle size={18} />
                <span>
                  Your GitHub session is missing or expired. Open{' '}
                  <Link to={`${dashboardPath({ view: 'settings' })}#compliance-scanner-github`}>Settings</Link> to connect,
                  then come back here.
                </span>
              </div>
            )}

            <div className="scanner-workbench">
              <header className="scanner-workbench-head">
                <div className="scanner-workbench-head-main">
                  <span className="scanner-workbench-kicker">Step 1 · Repositories</span>
                  <h2 className="scanner-workbench-title">Choose what to scan</h2>
                  <p className="scanner-workbench-lead">
                    GitHub sign-in is in app Settings. Here: pick an org or account, load repositories, then start a scan.
                  </p>
                </div>
                {sessionLogin && (
                  <div className="scanner-workbench-badge" title="GitHub session">
                    <Github size={16} aria-hidden />
                    <span>{sessionLogin}</span>
                  </div>
                )}
              </header>

              <div className="scanner-workbench-body">
                <div className="scanner-workbench-block">
                  <span className="scanner-workbench-label">Account & scope</span>
                  <div className="scanner-workbench-actions">
                    <button type="button" className="btn btn-secondary" onClick={loadOrgs} disabled={!!loading}>
                      {loading === 'orgs' ? <Loader2 size={16} className="spinner" /> : <Building2 size={16} />}
                      Load organizations
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={loadMyUserRepos}
                      disabled={!!loading || !sessionLogin}
                      title="Repos you own (personal account), including private ones"
                    >
                      {loading === 'user_repos' ? <Loader2 size={16} className="spinner" /> : <Globe size={16} />}
                      My repositories
                    </button>
                  </div>
                  <div className="scanner-workbench-field">
                    <label htmlFor="scanner-org">Organization or GitHub username</label>
                    <input
                      id="scanner-org"
                      name="organization"
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                      placeholder="e.g. acme-corp or your-username"
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
                  </div>
                  <p className="scanner-workbench-hint">
                    {orgs.length > 0
                      ? 'Use a tab below for quick switching, or type an org name and load repositories.'
                      : 'Load orgs or “My repositories”, or type a username and press Load repositories.'}
                  </p>
                </div>

                {(sessionLogin || orgs.length > 0) && (
                  <div className="scanner-workbench-block scanner-workbench-block--tabs">
                    <span className="scanner-workbench-label">Quick switch</span>
                    <div className="scanner-org-tabs" role="tablist" aria-label="Organization">
                      {sessionLogin && (
                        <button
                          type="button"
                          role="tab"
                          className={`scanner-org-tab${activeOrgTab === 'my' ? ' scanner-org-tab--active' : ''}`}
                          onClick={() => loadMyUserRepos()}
                          disabled={!!loading || !sessionLogin}
                        >
                          <Globe size={16} aria-hidden />
                          My Repos
                          {sessionLogin && orgRepoCounts[sessionLogin] != null && (
                            <span className="scanner-org-tab-count">({orgRepoCounts[sessionLogin]})</span>
                          )}
                        </button>
                      )}
                      {orgs.map((o) => (
                        <button
                          key={o}
                          type="button"
                          role="tab"
                          className={`scanner-org-tab${activeOrgTab === o && activeOrgTab !== 'my' ? ' scanner-org-tab--active' : ''}`}
                          onClick={() => loadRepos(o)}
                          disabled={!!loading}
                        >
                          <Building2 size={16} aria-hidden />
                          {o}
                          {orgRepoCounts[o] != null && <span className="scanner-org-tab-count">({orgRepoCounts[o]})</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="scanner-repo-shell">
                  <span className="scanner-workbench-label">Repository list</span>
                  <label className="scanner-scan-all-row">
                    <input
                      type="checkbox"
                      checked={scanAllOrg}
                      onChange={(e) => {
                        setScanAllOrg(e.target.checked)
                        if (e.target.checked) setSelectedNames(new Set())
                      }}
                    />
                    <span className="scanner-scan-all-copy">
                      <strong>Include every repository</strong>
                      <small>Scans all repos for the current org or user (slower).</small>
                    </span>
                  </label>
              <div className="scanner-repo-toolbar">
                <button type="button" className="btn btn-secondary" onClick={() => loadRepos()} disabled={!!loading || !org.trim()}>
                  {loading === 'repos' ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />}
                  Load repositories
                </button>
                <div className="scanner-repo-search">
                  <Search size={16} aria-hidden />
                  <input
                    type="search"
                    placeholder="Search repositories…"
                    value={repoFilter}
                    onChange={(e) => setRepoFilter(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-select-visible"
                  onClick={selectVisible}
                  disabled={scanAllOrg || !filteredRepos.length}
                >
                  <CheckCircle2 size={16} />
                  Select all visible
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={scanAllOrg}>
                  Clear
                </button>
              </div>

              {!scanAllOrg && repoList.length > 0 && (
                <div className="scanner-repo-list-wrap">
                  <ul className="scanner-repo-list">
                    {filteredRepos.map((r) => (
                      <li key={r.full_name}>
                        <label className="scanner-repo-row">
                          <input
                            type="checkbox"
                            checked={selectedNames.has(r.full_name)}
                            onChange={() => toggleRepo(r.full_name)}
                          />
                          <span className="scanner-repo-row-main">
                            <span className="scanner-repo-row-name">
                              {r.private ? <Lock size={14} className="scanner-repo-vis" aria-hidden /> : <Globe size={14} className="scanner-repo-vis" aria-hidden />}
                              <span className="scanner-repo-short">{r.full_name.split('/')[1] ?? r.full_name}</span>
                            </span>
                            <span className="scanner-repo-row-path">{r.full_name}</span>
                          </span>
                          <span className="scanner-repo-lang">{r.default_branch}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!scanAllOrg && repoList.length === 0 && (
                <div className="scanner-repo-list-placeholder">
                  <p className="scanner-repo-list-placeholder-title">No repositories in view</p>
                  <p className="scanner-repo-list-placeholder-sub">
                    Enter an org or username above, then use <strong>Load repositories</strong>.
                  </p>
                </div>
              )}

                  <div className="scanner-repo-footer">
                    <span className="scanner-repo-footer-count">
                      {scanAllOrg ? 'Entire org' : `${selectedNames.size} repositories selected`}
                      {repoList.length > 0 ? ` · ${repoList.length} loaded` : ''}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary scanner-start-scan"
                      onClick={startScan}
                      disabled={
                        !!loading ||
                        !org.trim() ||
                        (!scanAllOrg && selectedNames.size === 0)
                      }
                    >
                      {loading === 'start' ? <Loader2 size={18} className="spinner" /> : <ArrowRight size={18} />}
                      Start scan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}

          {flowStep === 2 && runId && (
            <section className="scanner-panel">
              <div className="scanner-scan-hero">
                <div className={`scanner-scan-icon${isRunning ? ' scanner-scan-icon--pulse' : ''}`}>
                  {isRunning ? <Loader2 size={28} className="spinner" /> : <ScanLine size={28} />}
                </div>
                <h2 className="scanner-scan-title">Scanning repositories</h2>
                <p className="scanner-scan-sub">
                  Analyzing {run?.counts?.repos_total ?? 0} repositor{(run?.counts?.repos_total ?? 0) === 1 ? 'y' : 'ies'}{' '}
                  for compliance…
                </p>
              </div>
              <div className="card scanner-progress-card">
                <div className="scanner-progress-bar-wrap">
                  <div className="scanner-progress-labels">
                    <span>
                      {run?.counts?.repos_done ?? 0} / {run?.counts?.repos_total ?? 0} repos
                    </span>
                    <span>{scanProgressPct}%</span>
                  </div>
                  <div className="scanner-progress-track">
                    <div className="scanner-progress-fill" style={{ width: `${scanProgressPct}%` }} />
                  </div>
                </div>
                <div className={`scanner-status-pill scanner-status-pill--${run?.status || 'none'}`}>
                  {run?.status === 'completed' && <CheckCircle2 size={16} />}
                  {run?.status === 'failed' && <XCircle size={16} />}
                  {(run?.status === 'queued' || run?.status === 'running') && <Loader2 size={16} className="spinner" />}
                  <span>
                    {run?.status === 'completed'
                      ? 'Done'
                      : run?.status === 'failed'
                        ? 'Failed'
                        : run?.status === 'running'
                          ? 'Running'
                          : run?.status === 'queued'
                            ? 'Queued'
                            : '—'}
                  </span>
                </div>
                <div className="scanner-metric-trio">
                  <div className="scanner-metric scanner-metric--ok">
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>{run?.counts?.repos_done ?? 0}</strong>
                      <span>Completed</span>
                    </div>
                  </div>
                  <div className="scanner-metric scanner-metric--pending">
                    <Loader2 size={18} className={isRunning ? 'spinner' : ''} />
                    <div>
                      <strong>
                        {Math.max(0, (run?.counts?.repos_total ?? 0) - (run?.counts?.repos_done ?? 0))}
                      </strong>
                      <span>Remaining</span>
                    </div>
                  </div>
                  <div className="scanner-metric scanner-metric--err">
                    <XCircle size={18} />
                    <div>
                      <strong>{run?.status === 'failed' ? run.errors?.length ?? 1 : 0}</strong>
                      <span>Errors</span>
                    </div>
                  </div>
                </div>
                <div className="scanner-progress-meta">
                  <span>
                    <strong>Run ID</strong> <code>{runId}</code>
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => refresh()} disabled={!canRefresh || !!loading}>
                    {loading === 'refresh' ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
                    Refresh
                  </button>
                </div>
                <div className="scanner-stats-grid scanner-stats-grid--dense">
                  <div>
                    <span>Files indexed</span>
                    <strong>{run?.counts?.files_indexed ?? 0}</strong>
                  </div>
                  <div>
                    <span>Chunks</span>
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
                {run?.status === 'failed' && run.errors && run.errors.length > 0 && (
                  <div className="scanner-run-errors" role="alert">
                    <strong>Scan failed</strong>
                    {run.errors.map((err, i) => (
                      <p key={i} className="scanner-run-error-msg">
                        {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="scanner-wizard-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFlowStep(1)}
                  disabled={isRunning}
                >
                  <ChevronLeft size={18} aria-hidden />
                  Back
                </button>
                {(run?.status === 'completed' ||
                  run?.status === 'failed' ||
                  run?.status === 'cancelled') && (
                  <button type="button" className="btn btn-primary" onClick={() => setFlowStep(3)}>
                    View results
                    <ArrowRight size={18} aria-hidden />
                  </button>
                )}
              </div>
            </section>
          )}

          {flowStep === 3 && (
          <section className="scanner-panel">
            <div className="scanner-section-head">
              <h2 className="scanner-section-title">Findings</h2>
              <p className="scanner-section-sub">Review controls, evidence, and export to your tracker.</p>
            </div>

            {findings.length > 0 && (
              <div className="scanner-findings-summary">
                <div className="scanner-summary-card">
                  <span className="scanner-summary-label">Compliance rate</span>
                  <strong className="scanner-summary-value">{findingStats.rate}%</strong>
                  <div className="scanner-summary-bar">
                    <div className="scanner-summary-bar-fill" style={{ width: `${findingStats.rate}%` }} />
                  </div>
                </div>
                <div className="scanner-summary-card scanner-summary-card--pass">
                  <CheckCircle2 size={20} />
                  <strong>{findingStats.passed}</strong>
                  <span>Passed</span>
                </div>
                <div className="scanner-summary-card scanner-summary-card--fail">
                  <XCircle size={20} />
                  <strong>{findingStats.failed}</strong>
                  <span>Failed</span>
                </div>
                <div className="scanner-summary-card scanner-summary-card--unknown">
                  <HelpCircle size={20} />
                  <strong>{findingStats.unknown}</strong>
                  <span>Unknown</span>
                </div>
              </div>
            )}

            <div className="card scanner-findings-card">
              {findings.length > 0 && (
                <div className="scanner-findings-toolbar">
                  <div className="scanner-findings-search">
                    <Search size={16} aria-hidden />
                    <input
                      type="search"
                      placeholder="Search findings by rule, description, or control…"
                      value={findingsQuery}
                      onChange={(e) => setFindingsQuery(e.target.value)}
                    />
                  </div>
                  <div className="scanner-findings-toolbar-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={exportJira}
                      disabled={!!loading || !runId || nonCompliant.length === 0 || !readJiraExportPrefs().project?.trim()}
                    >
                      {loading === 'jira' ? <Loader2 size={16} className="spinner" /> : <ExternalLink size={16} />}
                      Export to Jira
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={newScan} disabled={!!loading}>
                      <ScanLine size={16} />
                      New scan
                    </button>
                  </div>
                </div>
              )}

              {!findings.length ? (
                <p className="scanner-empty">No findings yet. Start a scan above, then refresh if needed.</p>
              ) : (
                <>
                  <p className="scanner-jira-settings-hint">
                    Jira project, URL, and credentials are set in the app{' '}
                    <Link to={dashboardPath({ view: 'settings' })}>Settings</Link> (same as the PDF workflow).
                  </p>

                  <ul className="scanner-finding-accordions">
                    {findingsFiltered.map((f, i) => {
                      const key = `${f.control_id}-${i}`
                      const open = expandedFindingKey === key
                      const pathHint = f.evidence_snippets?.[0]?.path ?? '—'
                      return (
                        <li key={key} className={`scanner-finding-acc${open ? ' scanner-finding-acc--open' : ''}`}>
                          <button
                            type="button"
                            className="scanner-finding-row"
                            onClick={() => setExpandedFindingKey(open ? null : key)}
                            aria-expanded={open}
                          >
                            <ChevronDown className={`scanner-finding-chevron${open ? ' scanner-finding-chevron--open' : ''}`} size={18} />
                            {f.status === 'compliant' && <CheckCircle2 className="scanner-finding-status scanner-finding-status--ok" size={18} />}
                            {f.status === 'non_compliant' && <XCircle className="scanner-finding-status scanner-finding-status--bad" size={18} />}
                            {f.status === 'unknown' && <HelpCircle className="scanner-finding-status scanner-finding-status--unk" size={18} />}
                            <code className="scanner-finding-id">{f.control_id}</code>
                            <span className="scanner-finding-row-title">{f.control_title}</span>
                            <span className={`scanner-severity scanner-severity--${severityBadge(f)}`}>{severityBadge(f)}</span>
                            <span className="scanner-finding-repo" title={pathHint}>
                              {pathHint}
                            </span>
                          </button>
                          {open && (
                            <div className="scanner-finding-detail">
                              <div className="scanner-finding-meta">
                                <div>
                                  <span className="scanner-meta-label">Summary</span>
                                  <p>{f.summary || '—'}</p>
                                </div>
                                <div>
                                  <span className="scanner-meta-label">Gap</span>
                                  <p>{f.gap_description || '—'}</p>
                                </div>
                              </div>
                              {(f.acceptance_criteria || []).length > 0 && (
                                <div className="scanner-criteria">
                                  <span className="scanner-meta-label">Acceptance criteria</span>
                                  <ul>
                                    {(f.acceptance_criteria || []).map((c, j) => (
                                      <li key={j}>{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(f.evidence_links || []).length > 0 && (
                                <div className="scanner-evidence-links">
                                  {(f.evidence_links || []).map((e, idx) => (
                                    <a key={idx} href={e.url} target="_blank" rel="noopener noreferrer">
                                      {e.label || 'Evidence'}
                                      <ExternalLink size={12} />
                                    </a>
                                  ))}
                                </div>
                              )}
                              {(f.evidence_snippets || []).length > 0 && (
                                <div className="scanner-snippet-blocks">
                                  {(f.evidence_snippets || []).map((sn, si) => (
                                    <div key={si} className="scanner-snippet">
                                      <div className="scanner-snippet-head">
                                        <FileCode size={14} />
                                        {sn.path && (
                                          <code>
                                            {sn.path}
                                            {sn.start_line != null ? `:${sn.start_line}` : ''}
                                          </code>
                                        )}
                                        {sn.why && <span className="scanner-snippet-why">{sn.why}</span>}
                                      </div>
                                      {sn.preview && <pre className="scanner-snippet-pre">{sn.preview}</pre>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  <p className="scanner-findings-foot">
                    {findingsFiltered.length} of {findings.length} findings shown
                  </p>
                </>
              )}
            </div>

            <div className="scanner-wizard-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setFlowStep(2)} disabled={!runId}>
                <ChevronLeft size={18} aria-hidden />
                Back to scan
              </button>
              <button type="button" className="btn btn-secondary" onClick={newScan} disabled={!!loading}>
                <ScanLine size={16} aria-hidden />
                New scan
              </button>
            </div>
          </section>
          )}
          </div>
        </div>
      </main>
    </div>
  )
}
