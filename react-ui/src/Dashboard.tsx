import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText,
  Upload,
  Play,
  Sparkles,
  Send,
  ChevronDown,
  Pencil,
  Check,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  FileCode,
  Github,
  Menu,
  History,
  ExternalLink,
  Moon,
  Sun,
  Copy,
  Search,
  Download,
  Plus,
  ShieldCheck,
  MessageCircle,
  PanelRightClose,
  Settings,
  Trash2,
  ScanLine,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  processDocument,
  extractTasks,
  exportToJira,
  exportToGitHub,
  getExportConfig,
  getExportHistory,
  getAuditLogs,
  getRegulationVersions,
  qaAsk,
  gapAnalysis,
  submitCalibrationFeedback,
  checkRegulationContentChange,
  appendAuditLog,
  resetAllData,
  authLogout,
  scannerGithubDisconnect,
} from './api'
import type { ExtractionTask } from './types'
import { Tooltip } from './Tooltip'
import { useTheme } from './useTheme'
import { ComplianceScannerGithubSettings } from './ComplianceScannerGithubSettings'
import { dashboardPath } from './dashboardPaths'
import { readJiraExportPrefs, writeJiraExportPrefs } from './jiraExportPrefs'
import './App.css'

const REGULATION_OPTIONS = ['HIPAA', 'GDPR', 'ADA/WCAG', 'FDA 21 CFR Part 11', 'Custom']

const PROMPT_SUGGESTIONS = [
  'Patient portal API with ePHI, MFA, audit logging',
  'SaaS B2B app with user data, EU customers (GDPR)',
  'Medical device software, FDA 21 CFR Part 11, electronic records',
  'Public-facing web app, ADA/WCAG accessibility required',
  'Healthcare mobile app with PHI, HIPAA compliance',
]

const TASK_TEMPLATES = [
  { title: 'Security review', description: 'Review and document security controls', priority: 'High' as const, acceptance_criteria: ['Document current controls', 'Identify gaps', 'Create remediation plan'] },
  { title: 'Accessibility audit', description: 'Audit for ADA/WCAG compliance', priority: 'Medium' as const, acceptance_criteria: ['Run automated tests', 'Manual keyboard nav', 'Screen reader testing'] },
  { title: 'Audit logging', description: 'Implement audit trail for sensitive operations', priority: 'High' as const, acceptance_criteria: ['Log access events', 'Immutable storage', 'Retention policy'] },
]

const EXPORT_PRESETS_KEY = 'regtranslate-export-presets'

const DEMO_MESSAGES = {
  step1: { title: '1. Select Regulation & Upload', body: 'Choose framework (HIPAA, GDPR, etc.) and upload your compliance document.' },
  step2Processing: { title: '2. Process Document', body: 'Extract text, chunk, and embed. Chunks are stored for RAG retrieval.' },
  step2Done: { title: '2. Process Document ✓', body: 'Chunks stored. Ready for extraction.' },
  step3Extracting: { title: '3. Extract Tasks', body: 'AI extracts actionable tasks with acceptance criteria and priorities.' },
  step3Done: { title: '3. Extract Tasks ✓', body: 'Tasks extracted. Review and edit as needed.' },
  step4: { title: '4. Review & Edit', body: 'Select tasks, edit details, and prepare for export.' },
  step5: { title: '5. Export to Jira ✓', body: 'One-click export with project, board, and sprint options.' },
  step6: { title: '6. Export to GitHub ✓', body: 'Create GitHub issues from selected tasks.' },
  qa: { title: 'Compliance Q&A ✓', body: 'Ask questions about the regulation. Conversation history preserved.' },
  settings: { title: 'Settings', body: 'Configure connections and defaults. Clear data to start fresh.' },
} as const

const DEMO_TASKS: ExtractionTask[] = [
  {
    task_id: 'demo-1',
    title: 'Implement Access Control',
    description: 'Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.',
    priority: 'High',
    penalty_risk: '',
    source_citation: 'HIPAA § 164.312(a)',
    source_text: 'Access control',
    responsible_role: 'Security Engineer',
    acceptance_criteria: ['Define access control policies', 'Implement RBAC', 'Enforce least privilege'],
    also_satisfies: [],
    confidence: 92,
    subtasks: [],
  },
  {
    task_id: 'demo-2',
    title: 'Implement Audit Controls',
    description: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain ePHI.',
    priority: 'High',
    penalty_risk: '',
    source_citation: 'HIPAA § 164.312(b)',
    source_text: 'Audit controls',
    responsible_role: 'DevOps',
    acceptance_criteria: ['Log all ePHI access events', 'Immutable audit trail', '90-day retention minimum'],
    also_satisfies: [],
    confidence: 88,
    subtasks: [],
  },
  {
    task_id: 'demo-3',
    title: 'Implement Integrity Controls',
    description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction.',
    priority: 'Medium',
    penalty_risk: '',
    source_citation: 'HIPAA § 164.312(c)',
    source_text: 'Integrity',
    responsible_role: 'Engineer',
    acceptance_criteria: ['Data validation', 'Checksums for stored ePHI', 'Change detection'],
    also_satisfies: [],
    confidence: 85,
    subtasks: [],
  },
]


interface ExportPreset {
  name: string
  jira?: { url?: string; email?: string; token?: string; project?: string; board?: string; sprint?: string; autoSprint?: boolean }
  github?: { repo?: string; token?: string }
}

export function Dashboard() {
  const navigate = useNavigate()
  const [docIds, setDocIds] = useState<string[]>([])
  const docId = docIds[0] ?? null
  const [regulationName, setRegulationName] = useState('Custom')
  const [tasks, setTasks] = useState<ExtractionTask[]>([])
  type LoadingState = 'process' | 'extract' | 'jira' | 'github' | null
  const [loading, setLoading] = useState<LoadingState>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const setFiles = (files: FileList | null) => {
    const arr = files ? Array.from(files) : []
    setSelectedFiles(arr)
    setSelectedFile(arr[0] ?? null)
  }
  const [dedupe, setDedupe] = useState(true)
  const [productContext, setProductContext] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())

  const [jiraUrl, setJiraUrl] = useState(() => {
    if (typeof window === 'undefined') return 'https://your-domain.atlassian.net'
    return readJiraExportPrefs().url || 'https://your-domain.atlassian.net'
  })
  const [jiraEmail, setJiraEmail] = useState(() => (typeof window === 'undefined' ? '' : readJiraExportPrefs().email || ''))
  const [jiraToken, setJiraToken] = useState(() => (typeof window === 'undefined' ? '' : readJiraExportPrefs().token || ''))
  const [jiraProject, setJiraProject] = useState(() => (typeof window === 'undefined' ? '' : readJiraExportPrefs().project || ''))
  const [jiraBoard, setJiraBoard] = useState('')
  const [jiraSprint, setJiraSprint] = useState('')
  const [jiraAutoSprint, setJiraAutoSprint] = useState(true)
  const [ghRepo, setGhRepo] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [customRegulation, setCustomRegulation] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [taskFilterPriority, setTaskFilterPriority] = useState<string>('')
  const [taskFilterConfidence, setTaskFilterConfidence] = useState<string>('')
  const { theme, toggleTheme } = useTheme()
  const [page, setPage] = useState<'main' | 'history' | 'audit' | 'settings'>(() => {
    if (typeof window === 'undefined') return 'main'
    const v = new URLSearchParams(window.location.search).get('view')
    if (v === 'history' || v === 'audit' || v === 'settings') return v
    return 'main'
  })
  const [auditEntries, setAuditEntries] = useState<Array<{ timestamp: string; user_id: string; action: string; resource_accessed: string; source_ip: string; details: string }>>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [coverage, setCoverage] = useState<{ chunk_count: number; pages_summary: string; sections: string[]; section_4_in_chunks: boolean } | null>(null)
  const [qaQuestion, setQaQuestion] = useState('')
  const [qaUseAgent, setQaUseAgent] = useState(false)
  const [qaMessages, setQaMessages] = useState<
    Array<{
      role: 'user' | 'assistant'
      content: string
      sources?: Array<{ text: string; page: string | number; section: string }>
      agent_steps?: Array<{ step: number; tool: string; detail: string; ts?: number }>
    }>
  >([])
  const [qaLoading, setQaLoading] = useState(false)
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [qaPanelOpen, setQaPanelOpen] = useState(false)
  const [gapResult, setGapResult] = useState<{ overlap: Array<{ task_a: ExtractionTask; task_b: ExtractionTask; similarity: number }>; unique_to_a: ExtractionTask[]; unique_to_b: ExtractionTask[]; label_a: string; label_b: string } | null>(null)
  const taskReviewRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (docId) setToolsExpanded(true)
  }, [docId])
  useEffect(() => {
    setQaMessages([])
  }, [docId])
  const [gapLoading, setGapLoading] = useState(false)
  const [regulationVersions, setRegulationVersions] = useState<Array<{ doc_id: string; regulation_name: string; source_filename: string; processed_at: string; version_label: string }>>([])
  const [versionChangeNotice, setVersionChangeNotice] = useState<{ filename: string; previousAt: string } | null>(null)

  const [searchParams] = useSearchParams()
  const isDemoMode = searchParams.get('demo') === '1'
  const viewParam = searchParams.get('view')
  const [demoMessage, setDemoMessage] = useState<{ title: string; body: string } | null>(null)
  const [demoZoom, setDemoZoom] = useState<'normal' | 'zoom-in' | 'zoom-focus'>('zoom-in')
  const demoAutoPlayRef = useRef<boolean>(false)

  useEffect(() => {
    if (isDemoMode) {
      const demoFile = new File([], 'sample-hipaa.pdf', { type: 'application/pdf' })
      setRegulationName('HIPAA')
      setSelectedFiles([demoFile])
      setSelectedFile(demoFile)
      setToolsExpanded(true)
      setDemoMessage(DEMO_MESSAGES.step1)
      setDemoZoom('zoom-in')
    }
  }, [isDemoMode])

  useEffect(() => {
    if (!isDemoMode || demoAutoPlayRef.current || page !== 'main') return
    demoAutoPlayRef.current = true

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const run = async () => {
      while (demoAutoPlayRef.current) {
        setDemoMessage(DEMO_MESSAGES.step1)
        setDemoZoom('zoom-in')
        await sleep(5500)

        setLoading('process')
        setDemoMessage(DEMO_MESSAGES.step2Processing)
        await sleep(3800)
        setDocIds(['demo-doc'])
        setTasks([])
        setLoading(null)
        setDemoMessage(DEMO_MESSAGES.step2Done)
        await sleep(4000)

        setLoading('extract')
        setDemoMessage(DEMO_MESSAGES.step3Extracting)
        setDemoZoom('zoom-focus')
        await sleep(3400)
        setCoverage({ chunk_count: 1, pages_summary: '1 page', sections: ['164.312'], section_4_in_chunks: false })
        for (let i = 0; i < DEMO_TASKS.length; i++) {
          setTasks((prev) => [...prev, DEMO_TASKS[i]])
          await sleep(500)
        }
        setSelectedTasks(new Set(DEMO_TASKS.map((t) => t.task_id)))
        setLoading(null)
        setDemoMessage(DEMO_MESSAGES.step4)
        setQaPanelOpen(true)
        await sleep(6500)

        setLoading('jira')
        setDemoZoom('zoom-in')
        await sleep(2800)
        const fakeKeys = DEMO_TASKS.map((_, i) => `REG-${i + 1}`)
        setDemoMessage({ title: '5. Export to Jira ✓', body: `Created: ${fakeKeys.join(', ')}` })
        setSuccess(`Created: ${fakeKeys.join(', ')}`)
        setLoading(null)
        await sleep(4500)

        setLoading('github')
        await sleep(2600)
        setDemoMessage({ title: '6. Export to GitHub ✓', body: `Created ${DEMO_TASKS.length} issue(s).` })
        setSuccess(`Created ${DEMO_TASKS.length} issue(s).`)
        setLoading(null)
        await sleep(4500)

        setDemoMessage(DEMO_MESSAGES.qa)
        setQaMessages([
          { role: 'user', content: 'What does HIPAA say about access control?' },
          {
            role: 'assistant',
            content:
              '## § 164.312 - Technical Safeguards\n\nAccording to HIPAA Section 164.312, **access control** requires implementing technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.',
          },
        ])
        await sleep(7000)

        setDocIds([])
        setTasks([])
        setSelectedTasks(new Set())
        setCoverage(null)
        setQaMessages([])
        setQaPanelOpen(false)
        setSuccess(null)
        setError(null)
        await sleep(3500)
      }
    }
    run()
    return () => { demoAutoPlayRef.current = false }
  }, [isDemoMode, page])

  useEffect(() => {
    if (isDemoMode) return
    const p = readJiraExportPrefs()
    getExportConfig()
      .then(({ jira, github }) => {
        if (jira.url) setJiraUrl(jira.url)
        else if (p.url) setJiraUrl(p.url)
        if (jira.email) setJiraEmail(jira.email)
        else if (p.email) setJiraEmail(p.email)
        if (jira.api_token) setJiraToken(jira.api_token)
        else if (p.token) setJiraToken(p.token)
        if (github.repo) setGhRepo(github.repo)
        if (github.token) setGhToken(github.token)
      })
      .catch(() => {})
  }, [isDemoMode])

  useEffect(() => {
    if (isDemoMode) return
    writeJiraExportPrefs({ project: jiraProject, url: jiraUrl, email: jiraEmail, token: jiraToken })
  }, [isDemoMode, jiraProject, jiraUrl, jiraEmail, jiraToken])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<Array<{ timestamp: string; target: string; project_key?: string; repo?: string; keys?: string[]; urls?: string[]; task_count: number; jira_url?: string }>>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [settingsResetLoading, setSettingsResetLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    if (!showClearConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowClearConfirm(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showClearConfirm])

  const handleResetAll = async () => {
    setShowClearConfirm(false)
    setSettingsResetLoading(true)
    clearMessages()
    try {
      await resetAllData()
      setDocIds([])
      setTasks([])
      setSelectedTasks(new Set())
      setCoverage(null)
      setVersionChangeNotice(null)
      setGapResult(null)
      setQaMessages([])
      setSelectedFiles([])
      setSelectedFile(null)
      loadHistory()
      loadAudit()
      setSuccess('All data cleared. Start fresh by uploading a document.')
      setRegulationVersions([])
      navigate(dashboardPath({ demo: isDemoMode }), { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear data')
    } finally {
      setSettingsResetLoading(false)
    }
  }

  const loadHistory = useCallback(() => {
    if (isDemoMode) {
      setHistoryEntries([])
      return
    }
    setHistoryLoading(true)
    getExportHistory(100)
      .then(({ entries }) => setHistoryEntries(entries))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false))
  }, [isDemoMode])

  const loadAudit = useCallback(() => {
    if (isDemoMode) {
      setAuditEntries([])
      return
    }
    setAuditLoading(true)
    getAuditLogs(100)
      .then(({ entries }) => setAuditEntries(entries))
      .catch(() => setAuditEntries([]))
      .finally(() => setAuditLoading(false))
  }, [isDemoMode])

  useEffect(() => {
    if (viewParam === 'history') {
      setPage('history')
      loadHistory()
    } else if (viewParam === 'audit') {
      setPage('audit')
      loadAudit()
    } else if (viewParam === 'settings') {
      setPage('settings')
      if (isDemoMode) setDemoMessage(DEMO_MESSAGES.settings)
    } else {
      setPage('main')
    }
  }, [viewParam, isDemoMode, loadHistory, loadAudit])

  const loadRegulationVersions = () => {
    if (isDemoMode) {
      setRegulationVersions([])
      return
    }
    getRegulationVersions(undefined, 20)
      .then(({ versions }) => setRegulationVersions(versions))
      .catch(() => setRegulationVersions([]))
  }

  const handleQaAsk = async () => {
    if (!docId || !qaQuestion.trim()) return
    const question = qaQuestion.trim()
    if (isDemoMode) {
      setQaMessages((prev) => [...prev, { role: 'user', content: question }])
      setQaQuestion('')
      setQaLoading(true)
      await new Promise((r) => setTimeout(r, 1200))
      setQaMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '## § 164.312 - Technical Safeguards\n\nAccording to HIPAA Section 164.312, **access control** requires implementing technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.',
        },
      ])
      setDemoMessage(DEMO_MESSAGES.qa)
      setQaLoading(false)
      return
    }
    setQaLoading(true)
    setQaMessages((prev) => [...prev, { role: 'user', content: question }])
    setQaQuestion('')
    const screenContext = {
      regulation_name: regulationName,
      task_count: tasks.length,
      tasks: tasks.map((t) => ({ title: t.title, priority: t.priority })),
      coverage: coverage ? { chunk_count: coverage.chunk_count, pages_summary: coverage.pages_summary, sections: coverage.sections } : undefined,
      recent_exports: historyEntries.slice(0, 5).map((e) => ({
        target: e.target,
        task_count: e.task_count,
        project_key: e.project_key,
        keys: e.keys,
        timestamp: e.timestamp,
      })),
    }
    try {
      const res = await qaAsk(docId, question, screenContext, { useAgent: qaUseAgent })
      setQaMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          ...(res.agent_steps && res.agent_steps.length > 0 ? { agent_steps: res.agent_steps } : {}),
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Q&A failed')
    } finally {
      setQaLoading(false)
    }
  }

  const handleGapAnalysis = async () => {
    if (isDemoMode) return
    if (tasks.length < 2) {
      setError('Need at least 2 tasks. Split: first half vs second half.')
      return
    }
    setGapLoading(true)
    setGapResult(null)
    try {
      const mid = Math.floor(tasks.length / 2)
      const res = await gapAnalysis({
        tasks_a: tasks.slice(0, mid),
        tasks_b: tasks.slice(mid),
        label_a: 'First half',
        label_b: 'Second half',
      })
      setGapResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gap analysis failed')
    } finally {
      setGapLoading(false)
    }
  }

  const handleCalibrationFeedback = (taskId: string, title: string, correct: boolean) => {
    if (isDemoMode) return
    submitCalibrationFeedback(taskId, title, correct)
      .then(() => setSuccess('Feedback recorded'))
      .catch((e) => setError(e instanceof Error ? e.message : 'Feedback failed'))
  }

  const saveExportPreset = () => {
    const preset = {
      name: `Preset ${new Date().toISOString().slice(0, 16)}`,
      jira: { url: jiraUrl, email: jiraEmail, token: jiraToken, project: jiraProject, board: jiraBoard, sprint: jiraSprint, autoSprint: jiraAutoSprint },
      github: { repo: ghRepo, token: ghToken },
    }
    const presets = JSON.parse(localStorage.getItem(EXPORT_PRESETS_KEY) || '[]')
    presets.push(preset)
    localStorage.setItem(EXPORT_PRESETS_KEY, JSON.stringify(presets))
    setSuccess('Export preset saved')
  }

  const loadExportPreset = (idx: number) => {
    const presets = JSON.parse(localStorage.getItem(EXPORT_PRESETS_KEY) || '[]')
    const p = presets[idx]
    if (p) {
      if (p.jira) {
        setJiraUrl(p.jira.url || '')
        setJiraEmail(p.jira.email || '')
        setJiraToken(p.jira.token || '')
        setJiraProject(p.jira.project || '')
        setJiraBoard(p.jira.board || '')
        setJiraSprint(p.jira.sprint || '')
        setJiraAutoSprint(p.jira.autoSprint ?? true)
      }
      if (p.github) {
        setGhRepo(p.github.repo || '')
        setGhToken(p.github.token || '')
      }
      setSuccess('Preset loaded')
    }
  }

  const getExportPresets = (): ExportPreset[] => JSON.parse(localStorage.getItem(EXPORT_PRESETS_KEY) || '[]')

  const selectAllTasks = () => setSelectedTasks(new Set(tasks.map((t) => t.task_id)))
  const deselectAllTasks = () => setSelectedTasks(new Set())
  const selectHighPriority = () => setSelectedTasks(new Set(tasks.filter((t) => t.priority === 'High').map((t) => t.task_id)))

  const addManualTask = (template?: (typeof TASK_TEMPLATES)[0]) => {
    const id = `manual-${Date.now()}`
    const t = template
      ? {
          task_id: id,
          title: template.title,
          description: template.description,
          priority: template.priority,
          penalty_risk: '',
          source_citation: 'Manual',
          source_text: '',
          responsible_role: 'Engineer',
          acceptance_criteria: template.acceptance_criteria,
          also_satisfies: [],
          subtasks: [],
        }
      : {
          task_id: id,
          title: 'New task',
          description: '',
          priority: 'Medium' as const,
          penalty_risk: '',
          source_citation: 'Manual',
          source_text: '',
          responsible_role: 'Engineer',
          acceptance_criteria: [],
          also_satisfies: [],
          subtasks: [],
        }
    setTasks((prev) => [...prev, t])
    setSelectedTasks((prev) => new Set([...prev, id]))
  }

  const exportToCsv = () => {
    const toExport = tasks.filter((t) => selectedTasks.has(t.task_id))
    if (!toExport.length) return
    const headers = ['Title', 'Description', 'Priority', 'Source', 'Role', 'Acceptance Criteria', 'Subtasks']
    const rows = toExport.map((t) => [
      t.title,
      t.description,
      t.priority,
      t.source_citation,
      t.responsible_role,
      (t.acceptance_criteria ?? []).join('; '),
      (t.subtasks ?? []).map((s) => `${s?.title}: ${s?.description}`).join('; '),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `regtranslate-tasks-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    setSuccess(`Exported ${toExport.length} tasks to CSV`)
  }

  const copyTaskAsMarkdown = useCallback((task: ExtractionTask) => {
    const ac = (task.acceptance_criteria ?? []).map((c) => `- ${c}`).join('\n')
    const subs = (task.subtasks ?? []).map((s) => `- **${s?.title}**: ${s?.description}`).join('\n')
    const md = `## ${task.title}\n\n${task.description}\n\n**Priority:** ${task.priority} | **Source:** ${task.source_citation}\n\n### Acceptance criteria\n${ac || '- (none)'}\n\n### Subtasks\n${subs || '- (none)'}`
    navigator.clipboard.writeText(md)
    setSuccess('Copied to clipboard')
  }, [])

  const filteredTasks = tasks.filter((t) => {
    if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !t.description.toLowerCase().includes(taskSearch.toLowerCase())) return false
    if (taskFilterPriority && t.priority !== taskFilterPriority) return false
    if (taskFilterConfidence === 'high' && (t.confidence == null || t.confidence < 80)) return false
    if (taskFilterConfidence === 'low' && (t.confidence != null && t.confidence >= 80)) return false
    return true
  })

  useEffect(() => {
    if (tasks.length > 0 && taskReviewRef.current) {
      taskReviewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [tasks.length])

  const handleExtractRef = useRef<() => void>(() => {})
  const handleExportJiraRef = useRef<() => void>(() => {})

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const logAudit = useCallback((action: string, resource: string, details: string) => {
    appendAuditLog({ user_id: 'web-ui', action, resource_accessed: resource, details }).catch(() => {})
  }, [])

  const effectiveRegulation = regulationName === 'Custom' && customRegulation.trim() ? customRegulation.trim() : regulationName

  const handleUpload = async () => {
    const files = selectedFiles.length ? selectedFiles : (selectedFile ? [selectedFile] : [])
    if (!files.length) return
    clearMessages()
    setVersionChangeNotice(null)
    setLoading('process')
    if (isDemoMode) {
      setDemoMessage(DEMO_MESSAGES.step2Processing)
      await new Promise((r) => setTimeout(r, 2200))
      setDocIds(['demo-doc'])
      setTasks([])
      setDemoMessage(DEMO_MESSAGES.step2Done)
      setSuccess('Processed 1 file(s). Ready for extraction.')
      setLoading(null)
      return
    }
    try {
      const firstFile = files[0]
      try {
        const check = await checkRegulationContentChange(firstFile, effectiveRegulation)
        if (check.content_changed && check.previous_processed_at) {
          const prevDate = new Date(check.previous_processed_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
          setVersionChangeNotice({ filename: firstFile.name, previousAt: prevDate })
        }
      } catch {
        // Version check failed (e.g. 404 if endpoint missing) — proceed with upload
      }
      const collectedIds: string[] = []
      let lastRes: { doc_id: string; chunk_count: number; regulation_name: string }
      for (let i = 0; i < files.length; i++) {
        const res = await processDocument(files[i], effectiveRegulation)
        lastRes = res
        collectedIds.push(res.doc_id)
        if (i < files.length - 1) setSuccess(`Processed ${res.chunk_count} chunks from ${files[i].name}. Next...`)
      }
      if (lastRes!) {
        setDocIds(collectedIds)
        setRegulationName(lastRes.regulation_name)
        setTasks([])
        setSuccess(`Processed ${files.length} file(s). Ready for extraction.`)
        logAudit('document_process', `doc/${lastRes.doc_id}`, `reg=${lastRes.regulation_name} chunks=${lastRes.chunk_count}`)
        loadRegulationVersions()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed')
    } finally {
      setLoading(null)
    }
  }

  const handleExtract = async () => {
    if (!docIds.length) return
    clearMessages()
    setLoading('extract')
    if (isDemoMode) {
      setDemoMessage(DEMO_MESSAGES.step3Extracting)
      await new Promise((r) => setTimeout(r, 1800))
      setCoverage({ chunk_count: 1, pages_summary: '1 page', sections: ['164.312'], section_4_in_chunks: false })
      for (let i = 0; i < DEMO_TASKS.length; i++) {
        setTasks((prev) => [...prev, DEMO_TASKS[i]])
        await new Promise((r) => setTimeout(r, 280))
      }
      setSelectedTasks(new Set(DEMO_TASKS.map((t) => t.task_id)))
      setLoading(null)
      setDemoMessage(DEMO_MESSAGES.step4)
      setQaPanelOpen(true)
      return
    }
    try {
      const res = await extractTasks({
        doc_ids: docIds,
        regulation_name: effectiveRegulation,
        dedupe,
        return_coverage: true,
        product_context: productContext.trim() || null,
        rag_query: productContext.trim() || null,
      })
      const normalized = (res.tasks ?? []).map((t) => ({
        ...t,
        acceptance_criteria: t.acceptance_criteria ?? [],
        subtasks: t.subtasks ?? [],
      }))
      setTasks(normalized)
      setSelectedTasks(new Set(normalized.map((t) => t.task_id ?? '').filter(Boolean)))
      setCoverage(res.coverage ?? null)
      logAudit('task_extract', `doc/${docIds.join(',')}`, `tasks=${normalized.length} reg=${effectiveRegulation}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setLoading(null)
    }
  }

  const toggleTask = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const updateTask = (taskId: string, updates: Partial<ExtractionTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.task_id === taskId ? { ...t, ...updates } : t))
    )
  }

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.task_id !== taskId))
    setSelectedTasks((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }

  const handleExportJira = async () => {
    if (isDemoMode) {
      const toExport = tasks.filter((t) => selectedTasks.has(t.task_id))
      setLoading('jira')
      await new Promise((r) => setTimeout(r, 1500))
      const fakeKeys = toExport.map((_, i) => `REG-${i + 1}`)
      setDemoMessage({ title: DEMO_MESSAGES.step5.title.replace(' ✓', ''), body: `Created: ${fakeKeys.join(', ')}` })
      setSuccess(`Created: ${fakeKeys.join(', ')}`)
      setLoading(null)
      return
    }
    const toExport = tasks.filter((t) => selectedTasks.has(t.task_id))
    if (!toExport.length || !jiraProject) {
      setError('Select at least one task and provide project key.')
      return
    }
    clearMessages()
    setLoading('jira')
    try {
      const res = await exportToJira({
        tasks: toExport,
        project_key: jiraProject,
        url: jiraUrl || null,
        email: jiraEmail || null,
        api_token: jiraToken || null,
        sprint_id: jiraSprint ? parseInt(jiraSprint, 10) : null,
        board_id: jiraBoard ? parseInt(jiraBoard, 10) : null,
        auto_create_sprint: jiraAutoSprint && !jiraSprint && !!jiraBoard,
      })
      setSuccess(`Created: ${res.keys.join(', ')}`)
      loadHistory()
      logAudit('jira_export', `project/${jiraProject}`, `keys=${res.keys.join(', ')} count=${toExport.length}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Jira export failed')
    } finally {
      setLoading(null)
    }
  }

  useEffect(() => {
    handleExtractRef.current = handleExtract
    handleExportJiraRef.current = handleExportJira
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'e' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        if (docId && !loading) handleExtractRef.current()
      }
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        if (tasks.length && selectedTasks.size && jiraProject) handleExportJiraRef.current()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [docId, loading, tasks.length, selectedTasks.size, jiraProject])

  const handleExportGitHub = async () => {
    if (isDemoMode) {
      const toExport = tasks.filter((t) => selectedTasks.has(t.task_id))
      setLoading('github')
      await new Promise((r) => setTimeout(r, 1200))
      setDemoMessage({ title: DEMO_MESSAGES.step6.title.replace(' ✓', ''), body: `Created ${toExport.length} issue(s).` })
      setSuccess(`Created ${toExport.length} issue(s).`)
      setLoading(null)
      return
    }
    const toExport = tasks.filter((t) => selectedTasks.has(t.task_id))
    if (!toExport.length || !ghRepo || !ghToken) {
      setError('Select at least one task and provide a repository and GitHub credential.')
      return
    }
    clearMessages()
    setLoading('github')
    try {
      const res = await exportToGitHub({
        tasks: toExport,
        repo: ghRepo,
        token: ghToken,
      })
      setSuccess(`Created ${res.urls.length} issue(s).`)
      loadHistory()
      logAudit('github_export', `repo/${ghRepo}`, `issues=${res.urls.length} count=${toExport.length}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GitHub export failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="app app-dashboard">
      {showClearConfirm && (
        <div
          className="confirm-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-clear-title"
          onClick={() => !settingsResetLoading && setShowClearConfirm(false)}
        >
          <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-clear-title" className="confirm-modal-title">Clear all data?</h3>
            <p className="confirm-modal-desc">
              This removes documents, tasks, audit logs, export history, and version tracking. You can&apos;t undo this.
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowClearConfirm(false)}
                disabled={settingsResetLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ color: 'white', background: 'var(--error)', borderColor: 'var(--error)' }}
                onClick={() => handleResetAll()}
                disabled={settingsResetLoading}
              >
                {settingsResetLoading ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
                {settingsResetLoading ? 'Clearing…' : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(loading === 'jira' || loading === 'github') && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-overlay-content">
            <Loader2 size={48} className="spinner" strokeWidth={2} />
            <h3 className="loading-overlay-title">
              {loading === 'jira' ? 'Creating Jira tickets…' : 'Creating GitHub issues…'}
            </h3>
            <p className="loading-overlay-desc">
              {loading === 'jira'
                ? 'This may take a minute. Please wait.'
                : 'This may take a moment. Please wait.'}
            </p>
          </div>
        </div>
      )}

      <header className="mobile-header">
        <Link to="/dashboard" className="mobile-header-brand">
          <FileText size={22} strokeWidth={2} />
          RegTranslate
        </Link>
        <Tooltip content="Open navigation menu">
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        </Tooltip>
      </header>

      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Link to={dashboardPath({ demo: isDemoMode })} title="RegTranslate">
            <FileText size={24} strokeWidth={2} />
          </Link>
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <Tooltip content="PDF → Jira / GitHub" side="right">
            <Link
              to={dashboardPath({ demo: isDemoMode })}
              className={page === 'main' ? 'active' : ''}
              title="PDF workflow"
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setSidebarOpen(false) }}
            >
              <FileCode size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="Compliance Scanner" side="right">
            <Link
              to="/scanner/app"
              title="Compliance Scanner"
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setSidebarOpen(false) }}
            >
              <ScanLine size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="History" side="right">
            <Link
              to={dashboardPath({ demo: isDemoMode, view: 'history' })}
              className={page === 'history' ? 'active' : ''}
              title="Export history"
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setSidebarOpen(false) }}
            >
              <History size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="Audit trail" side="right">
            <Link
              to={dashboardPath({ demo: isDemoMode, view: 'audit' })}
              className={page === 'audit' ? 'active' : ''}
              title="Audit trail"
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setSidebarOpen(false) }}
            >
              <ShieldCheck size={20} />
            </Link>
          </Tooltip>
          <Tooltip content="Settings" side="right">
            <Link
              to={dashboardPath({ demo: isDemoMode, view: 'settings' })}
              className={page === 'settings' ? 'active' : ''}
              title="Settings"
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setSidebarOpen(false) }}
            >
              <Settings size={20} />
            </Link>
          </Tooltip>
          {docId && (
            <Tooltip content="Q&A" side="right">
              <a
                href={dashboardPath({ demo: isDemoMode })}
                className={qaPanelOpen ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault()
                  ;(e.currentTarget as HTMLElement).blur()
                  navigate(dashboardPath({ demo: isDemoMode }))
                  setSidebarOpen(false)
                  setQaPanelOpen(true)
                }}
              >
                <MessageCircle size={20} />
              </a>
            </Tooltip>
          )}
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

      <div className="toast-stack" aria-live="polite">
        {error && (
          <div className="toast-popup toast-error" role="alert">
            <XCircle size={20} />
            <span>{error}</span>
            <button type="button" className="toast-dismiss" onClick={() => setError(null)} aria-label="Dismiss">
              <X size={18} />
            </button>
          </div>
        )}
        {success && (
          <div className="toast-popup toast-success" role="status">
            <CheckCircle2 size={20} />
            <span>{success}</span>
            <button type="button" className="toast-dismiss" onClick={() => setSuccess(null)} aria-label="Dismiss">
              <X size={18} />
            </button>
          </div>
        )}
        {loading && loading !== 'jira' && loading !== 'github' && (
          <div className="toast-popup toast-info" role="status">
            <Loader2 size={20} className="spinner" />
            <span>{loading === 'process' ? 'Processing PDF(s)…' : 'Extracting tasks…'}</span>
          </div>
        )}
        {versionChangeNotice && (
          <div className="toast-popup toast-warning" role="alert">
            <AlertTriangle size={20} />
            <div className="toast-popup-content">
              <strong>Document content has changed</strong>
              <span>{versionChangeNotice.filename} differs from the version last processed on {versionChangeNotice.previousAt}. A new version has been created.</span>
            </div>
            <button type="button" className="toast-dismiss" onClick={() => setVersionChangeNotice(null)} aria-label="Dismiss">
              <X size={18} />
            </button>
          </div>
        )}
        {page === 'audit' && auditLoading && auditEntries.length === 0 && (
          <div className="toast-popup toast-info" role="status">
            <Loader2 size={20} className="spinner" />
            <span>Loading audit logs…</span>
          </div>
        )}
        {page === 'history' && historyLoading && historyEntries.length === 0 && (
          <div className="toast-popup toast-info" role="status">
            <Loader2 size={20} className="spinner" />
            <span>Loading history…</span>
          </div>
        )}
      </div>

      <main className={`main ${isDemoMode ? 'demo-main' : ''}`}>
        <div className={`demo-zoom-wrapper ${isDemoMode ? `demo-zoom-${demoZoom}` : ''}`}>
        <div className="main-inner">
          {isDemoMode && (
            <div className="demo-public-banner" role="note">
              <span>Guided preview — no sign-in required.</span>
              <span className="demo-public-banner-actions">
                <Link to="/signup" className="demo-public-banner-link">
                  Create access
                </Link>
                <span className="demo-public-banner-sep" aria-hidden>
                  ·
                </span>
                <Link to="/login" className="demo-public-banner-link">
                  Sign in
                </Link>
              </span>
            </div>
          )}
          <header className="workspace-header">
            <div className="workspace-header-main">
              <span className="workspace-eyebrow">
                {page === 'main'
                  ? 'Pipeline'
                  : page === 'history'
                    ? 'History'
                    : page === 'audit'
                      ? 'Audit'
                      : 'Settings'}
              </span>
              <h1>
                {page === 'main'
                  ? 'RegTranslate'
                  : page === 'history'
                    ? 'Export history'
                    : page === 'audit'
                      ? 'Audit trail'
                      : 'Settings'}
              </h1>
              <p>
                {page === 'main'
                  ? 'Upload a regulation PDF, extract tasks with context, then export to Jira or GitHub.'
                  : page === 'history'
                    ? 'Jira tickets and GitHub issues you created from tasks in this workspace.'
                    : page === 'audit'
                      ? 'Tamper-evident log of access and actions (audit policy 2.2.1).'
                      : 'GitHub session, Jira and GitHub defaults, and clearing local workspace data.'}
              </p>
            </div>
            <div className="workspace-header-actions">
              {page === 'main' && docId && (
                <Tooltip content={qaPanelOpen ? 'Close Q&A panel' : 'Open Q&A panel'}>
                  <button
                    type="button"
                    className={`btn ${qaPanelOpen ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setQaPanelOpen(!qaPanelOpen)}
                    aria-expanded={qaPanelOpen}
                  >
                    <MessageCircle size={18} />
                    Q&amp;A
                  </button>
                </Tooltip>
              )}
              {page === 'audit' && (
                <button className="btn btn-secondary" type="button" onClick={() => loadAudit()} disabled={auditLoading}>
                  {auditLoading ? <Loader2 size={16} className="spinner" /> : <ShieldCheck size={16} />}
                  Refresh
                </button>
              )}
              {page === 'history' && (
                <button className="btn btn-secondary" type="button" onClick={() => loadHistory()} disabled={historyLoading}>
                  {historyLoading ? <Loader2 size={16} className="spinner" /> : <History size={16} />}
                  Refresh
                </button>
              )}
            </div>
          </header>
          {page === 'audit' ? (
            <AuditPage entries={auditEntries} />
          ) : page === 'history' ? (
            <HistoryPage entries={historyEntries} />
          ) : page === 'settings' ? (
            <SettingsPage
              isDemoMode={isDemoMode}
              onResetAll={() => setShowClearConfirm(true)}
              onSignOut={async () => {
                try {
                  await authLogout()
                } catch {
                  /* still leave app */
                }
                try {
                  await scannerGithubDisconnect()
                } catch {
                  /* still leave app */
                }
                navigate(isDemoMode ? '/' : '/login', { replace: true })
              }}
              loading={settingsResetLoading}
              jiraProject={jiraProject}
              setJiraProject={setJiraProject}
              jiraUrl={jiraUrl}
              setJiraUrl={setJiraUrl}
              jiraEmail={jiraEmail}
              setJiraEmail={setJiraEmail}
              jiraToken={jiraToken}
              setJiraToken={setJiraToken}
              ghRepo={ghRepo}
              setGhRepo={setGhRepo}
              ghToken={ghToken}
              setGhToken={setGhToken}
            />
          ) : (
          <>
          {isDemoMode && demoMessage && page === 'main' && (
            <div key={demoMessage.title} className="demo-message-overlay">
              <h2 className="demo-message-title">{demoMessage.title}</h2>
              <p className="demo-message-body">{demoMessage.body}</p>
            </div>
          )}
          {page === 'main' && (
            <nav className="workflow-rail" aria-label="Workflow steps">
              <span className={`workflow-rail-step${docIds.length > 0 ? ' done' : ' current'}`}>
                1 · Upload
              </span>
              <span className="workflow-rail-join" aria-hidden />
              <span
                className={`workflow-rail-step${
                  tasks.length > 0 ? ' done' : docIds.length > 0 ? ' current' : ''
                }`}
              >
                2 · Extract
              </span>
              <span className="workflow-rail-join" aria-hidden />
              <span className={`workflow-rail-step${tasks.length > 0 ? ' current' : ''}`}>
                3 · Review &amp; export
              </span>
            </nav>
          )}

          {!tasks.length && page === 'main' && (
            <p className="pipeline-hint">
              <strong>Next:</strong> choose a regulation, add your PDF, and run <strong>Process</strong>. Then run{' '}
              <strong>Extract tasks</strong> to generate work items you can send to Jira or GitHub.
            </p>
          )}

        <div className="pipeline-row">
            <section className="step">
              <div className="step-header compact">
                <span className="step-number">1</span>
                <div>
                  <h2 className="step-title">Upload</h2>
                  <p className="step-desc">Pick your framework and add one or more PDFs.</p>
                </div>
              </div>
              <div className="card">
                <div className="input-group">
                  <Tooltip content="Select the regulation framework for your document (e.g. HIPAA, GDPR)">
                    <label htmlFor="regulation">Regulation type</label>
                  </Tooltip>
                  <select
                    id="regulation"
                    value={regulationName}
                    onChange={(e) => setRegulationName(e.target.value)}
                    aria-label="Regulation type"
                  >
                    {REGULATION_OPTIONS.map((r) => (
                      <option key={r} value={r === 'Custom' ? 'Custom' : r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {regulationName === 'Custom' && (
                    <input
                      type="text"
                      placeholder="e.g. SOC 2, ISO 27001"
                      value={customRegulation}
                      onChange={(e) => setCustomRegulation(e.target.value)}
                      style={{ marginTop: 'var(--space-2)' }}
                    />
                  )}
                </div>
                <Tooltip content="Upload a regulatory PDF document to process">
                <div
                  className={`upload-zone ${selectedFiles.length || selectedFile ? 'has-file' : ''}`}
                  onClick={() => document.getElementById('file-input')?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload PDF file"
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => setFiles(e.target.files)}
                  />
                  <div className="upload-zone-content">
                    <Upload size={28} strokeWidth={1.5} />
                    {selectedFiles.length > 0 || selectedFile ? (
                      <>
                        <span>{selectedFiles.length > 1 ? `${selectedFiles.length} files` : (selectedFiles[0] || selectedFile)?.name}</span>
                        {(selectedFiles.length > 0 ? selectedFiles : selectedFile ? [selectedFile] : []).length > 1 && (
                          <ul className="upload-zone-filenames" aria-label="Selected files">
                            {(selectedFiles.length > 0 ? selectedFiles : [selectedFile!]).map((f, i) => (
                              <li key={i}>{f.name}</li>
                            ))}
                          </ul>
                        )}
                        <span style={{ fontSize: 'var(--text-xs)' }}>Click to change</span>
                      </>
                    ) : (
                      <>
                        <span>Drop PDF(s) or click</span>
                        <span>Accepts .pdf · Multiple files for batch</span>
                      </>
                    )}
                  </div>
                </div>
                </Tooltip>
                <div className="card-actions">
                  <Tooltip content="Process the PDF and prepare chunks for extraction">
                  <button
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={(!selectedFiles.length && !selectedFile) || !!loading}
                    aria-busy={!!loading}
                  >
                    {loading === 'process' ? <Loader2 size={16} className="spinner" /> : <Play size={16} />}
                    Process
                  </button>
                  </Tooltip>
                </div>
              </div>
            </section>

            <section className="step">
              <div className="step-header compact">
                <span className="step-number">2</span>
                <div>
                  <h2 className="step-title">Extract</h2>
                  <p className="step-desc">Optional product context helps the model stay on-topic.</p>
                </div>
              </div>
              <div className="card">
                <Tooltip content="Merge duplicate tasks across documents and regulations">
                <label className="checkbox-row">
                  <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
                  Deduplicate across documents
                </label>
                </Tooltip>
                <div className="input-group">
                  <Tooltip content="Describe your product for focused task extraction">
                  <label htmlFor="product-context">Product context (optional)</label>
                  </Tooltip>
                  <textarea
                    id="product-context"
                    placeholder="e.g. Patient portal API with ePHI, MFA..."
                    value={productContext}
                    onChange={(e) => setProductContext(e.target.value)}
                    rows={2}
                    aria-describedby="product-context-hint"
                  />
                  <div className="prompt-suggestions">
                    <span className="prompt-suggestions-label">Suggestions:</span>
                    {PROMPT_SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="prompt-suggestion-chip"
                        onClick={() => setProductContext(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <span id="product-context-hint" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    Describe your product for focused extraction
                  </span>
                </div>
                <div className="card-actions">
                  <Tooltip content="Extract compliance tasks using RAG + LLM">
                  <button
                    className="btn btn-primary"
                    onClick={handleExtract}
                    disabled={!docIds.length || !!loading}
                    aria-busy={!!loading}
                  >
                    {loading === 'extract' ? <Loader2 size={16} className="spinner" /> : <Sparkles size={16} />}
                    Extract tasks
                  </button>
                  </Tooltip>
                </div>
              </div>
            </section>
          </div>

          {docIds.length > 0 && (
            <Tooltip content={docIds.length === 1 ? `Document ID: ${docIds[0]}` : `${docIds.length} documents · IDs: ${docIds.join(', ')}`}>
              <div className="doc-id-pill" role="status">
                <Info size={18} />
                <span className="doc-id-value"><code>{docIds.length === 1 ? docIds[0] : `${docIds.length} docs`}</code></span>
                <span className="doc-id-reg">{regulationName}</span>
              </div>
            </Tooltip>
          )}

          {docId && (
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setToolsExpanded(!toolsExpanded); if (!toolsExpanded) loadRegulationVersions(); }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {toolsExpanded ? <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} /> : <ChevronDown size={16} />}
                Gap analysis & Regulation versions
              </button>
              {toolsExpanded && (
                <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {tasks.length >= 2 && (
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Gap analysis</h4>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleGapAnalysis} disabled={gapLoading}>
                        {gapLoading ? <Loader2 size={14} className="spinner" /> : 'Compare first half vs second half'}
                      </button>
                      {gapResult && (
                        <div className="gap-analysis-result">
                          <div className="gap-analysis-venn">
                            <div className="gap-venn-left">
                              <span className="gap-venn-count">{gapResult.unique_to_a.length}</span>
                              <span className="gap-venn-label">Only {gapResult.label_a}</span>
                            </div>
                            <div className="gap-venn-center">
                              <span className="gap-venn-count">{gapResult.overlap.length}</span>
                              <span className="gap-venn-label">Overlap</span>
                            </div>
                            <div className="gap-venn-right">
                              <span className="gap-venn-count">{gapResult.unique_to_b.length}</span>
                              <span className="gap-venn-label">Only {gapResult.label_b}</span>
                            </div>
                          </div>
                          <details className="gap-analysis-details">
                            <summary>View tasks</summary>
                            <div className="gap-analysis-tasks">
                              {gapResult.unique_to_a.length > 0 && (
                                <div className="gap-task-group">
                                  <h5>Only in {gapResult.label_a}</h5>
                                  <ul>
                                    {gapResult.unique_to_a.map((t, i) => (
                                      <li key={i}>{t.title}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {gapResult.overlap.length > 0 && (
                                <div className="gap-task-group gap-overlap">
                                  <h5>Overlapping pairs</h5>
                                  <ul>
                                    {gapResult.overlap.map((o, i) => (
                                      <li key={i}>
                                        <strong>{o.task_a.title}</strong> ↔ {o.task_b.title}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {gapResult.unique_to_b.length > 0 && (
                                <div className="gap-task-group">
                                  <h5>Only in {gapResult.label_b}</h5>
                                  <ul>
                                    {gapResult.unique_to_b.map((t, i) => (
                                      <li key={i}>{t.title}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Regulation versions</h4>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={loadRegulationVersions}>Refresh</button>
                    {regulationVersions.length > 0 && (
                      <ul style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', listStyle: 'none', padding: 0 }}>
                        {regulationVersions.slice(0, 5).map((v, i) => (
                          <li key={i} style={{ padding: 'var(--space-1) 0' }}>{v.regulation_name} · {v.source_filename} · {v.version_label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {coverage && tasks.length > 0 && (
            <div className="compliance-coverage">
              <h3 className="compliance-coverage-title">Coverage</h3>
              <div className="compliance-coverage-stats">
                <div className="coverage-stat">
                  <span className="coverage-stat-value">{coverage.chunk_count}</span>
                  <span className="coverage-stat-label">Chunks</span>
                </div>
                <div className="coverage-stat">
                  <span className="coverage-stat-value">{coverage.pages_summary.replace('pages ', '')}</span>
                  <span className="coverage-stat-label">Pages</span>
                </div>
                <div className={`coverage-stat ${coverage.section_4_in_chunks ? 'coverage-stat-ok' : ''}`}>
                  <span className="coverage-stat-value">{coverage.section_4_in_chunks ? '✓' : '—'}</span>
                  <span className="coverage-stat-label">§4 in RAG</span>
                </div>
              </div>
              {coverage.sections.length > 0 && (
                <div className="compliance-coverage-sections">
                  <span className="coverage-sections-label">Sections in context</span>
                  <div className="coverage-section-chips">
                    {coverage.sections.slice(0, 12).map((s, i) => (
                      <span key={i} className="coverage-section-chip" title={s}>
                        {s.length > 40 ? s.slice(0, 37) + '…' : s}
                      </span>
                    ))}
                    {coverage.sections.length > 12 && (
                      <span className="coverage-section-chip coverage-section-more">+{coverage.sections.length - 12}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        {tasks.length > 0 && (
          <section className="step" ref={taskReviewRef}>
            <div className="step-header" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <span className="step-number">3</span>
              <h2 className="step-title">Task review</h2>
              <div className="task-review-actions">
                <div className="task-search-row">
                  <Search size={16} />
                  <input
                    type="search"
                    placeholder="Search tasks..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="task-search-input"
                  />
                  <select value={taskFilterPriority} onChange={(e) => setTaskFilterPriority(e.target.value)} className="task-filter-select">
                    <option value="">All priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <select value={taskFilterConfidence} onChange={(e) => setTaskFilterConfidence(e.target.value)} className="task-filter-select">
                    <option value="">All confidence</option>
                    <option value="high">High (≥80%)</option>
                    <option value="low">Low (&lt;80%)</option>
                  </select>
                </div>
                <div className="bulk-select-row">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllTasks}>Select all</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={deselectAllTasks}>Deselect all</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={selectHighPriority}>High priority only</button>
                </div>
                <div className="add-task-row">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addManualTask()}>
                    <Plus size={14} />
                    Add task
                  </button>
                  <div className="task-templates-dropdown">
                    {TASK_TEMPLATES.map((tpl, i) => (
                      <button key={i} type="button" className="btn btn-ghost btn-sm" onClick={() => addManualTask(tpl)}>
                        {tpl.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="step-desc">Select tasks to export. Edit before exporting if needed. Ctrl+Shift+E: Extract · Ctrl+Shift+S: Export Jira</p>
            <div className="task-list">
              {filteredTasks.map((task, idx) => (
                <TaskCard
                  key={task.task_id}
                  task={task}
                  selected={selectedTasks.has(task.task_id)}
                  onToggle={() => toggleTask(task.task_id)}
                  onUpdate={(updates) => updateTask(task.task_id, updates)}
                  onDelete={() => deleteTask(task.task_id)}
                  onCopyMarkdown={() => copyTaskAsMarkdown(task)}
                  onCalibrationFeedback={handleCalibrationFeedback}
                  expandIn={isDemoMode && idx === 0 ? 900 : undefined}
                />
              ))}
            </div>
            {filteredTasks.length === 0 && tasks.length > 0 && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No tasks match your filters.</p>
            )}
          </section>
        )}

          {tasks.length > 0 && (
            <section className="step">
              <div className="step-header">
                <span className="step-number">4</span>
                <h2 className="step-title">Export</h2>
              </div>
              <div className="export-presets-row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={saveExportPreset}>Save preset</button>
                {getExportPresets().length > 0 && (
                  <select
                    className="preset-select"
                    onChange={(e) => { const v = e.target.value; if (v !== '') loadExportPreset(parseInt(v, 10)); e.target.value = ''; }}
                  >
                    <option value="">Load preset...</option>
                    {getExportPresets().map((p, i) => (
                      <option key={i} value={i}>{p.name}</option>
                    ))}
                  </select>
                )}
                <Tooltip content="Export selected tasks to CSV">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={exportToCsv}>
                    <Download size={14} />
                    Export CSV
                  </button>
                </Tooltip>
              </div>
              <div className="export-grid">
              <div className="export-panel">
                <div className="export-panel-header">
                  <FileCode size={18} />
                  Jira
                </div>
                <p className="export-panel-hint">
                  Jira site, credentials, and project key are configured in{' '}
                  <Link to={dashboardPath({ view: 'settings', demo: isDemoMode })}>Settings</Link>.
                </p>
                <div className="input-group">
                  <Tooltip content="Board ID from URL .../boards/42">
                    <label htmlFor="jira-board">Board ID (optional)</label>
                  </Tooltip>
                  <input id="jira-board" type="text" value={jiraBoard} onChange={(e) => setJiraBoard(e.target.value)} placeholder="e.g. 42" />
                </div>
                <div className="input-group">
                  <Tooltip content="Sprint ID for backlog assignment">
                    <label htmlFor="jira-sprint">Sprint ID (optional)</label>
                  </Tooltip>
                  <input id="jira-sprint" type="text" value={jiraSprint} onChange={(e) => setJiraSprint(e.target.value)} placeholder="e.g. 123" />
                </div>
                <div className="export-panel-actions">
                  <Tooltip content="Create or use active sprint if none specified">
                    <label className="checkbox-row">
                      <input type="checkbox" checked={jiraAutoSprint} onChange={(e) => setJiraAutoSprint(e.target.checked)} />
                      Auto-create sprint if none exists
                    </label>
                  </Tooltip>
                  <Tooltip content="Create Jira issues for selected tasks">
                    <button className="btn btn-primary" onClick={handleExportJira} disabled={!!loading}>
                      {loading === 'jira' ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
                      Export to Jira
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="export-panel">
                <div className="export-panel-header">
                  <Github size={18} />
                  GitHub
                </div>
                <p className="export-panel-hint">Repository and GitHub sign-in are saved in Settings.</p>
                <Tooltip content="Create GitHub issues for selected tasks">
                  <button className="btn btn-primary" onClick={handleExportGitHub} disabled={!!loading}>
                    {loading === 'github' ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
                    Export to GitHub
                  </button>
                </Tooltip>
              </div>
              </div>
            </section>
          )}

          </>
          )}
        </div>
        </div>
      </main>

      {docId && (
        <>
          <div
            className={`qa-panel-tab ${qaPanelOpen ? 'open' : ''}`}
            onClick={() => !qaPanelOpen && setQaPanelOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && !qaPanelOpen && setQaPanelOpen(true)}
            aria-label="Open Q&A panel"
          >
            <MessageCircle size={20} />
            <span>Q&A</span>
          </div>
          <aside className={`qa-panel ${qaPanelOpen ? 'open' : ''}`}>
            <div className="qa-panel-header">
              <h3>Compliance Q&A</h3>
              <Tooltip content="Close panel">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQaPanelOpen(false)} aria-label="Close Q&A panel">
                  <PanelRightClose size={18} />
                </button>
              </Tooltip>
            </div>
            <div className="qa-panel-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Ask about the regulation or the current workspace (tasks, coverage, exports).</p>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-3)',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={qaUseAgent} onChange={(e) => setQaUseAgent(e.target.checked)} disabled={qaLoading} />
                Multi-step Q&amp;A (retrieval tools + Groq; uses GROQ_API_KEY on the server)
              </label>
              <div className="qa-chat-messages">
                {qaMessages.map((msg, i) => (
                  <div key={i} className={`qa-chat-bubble qa-chat-bubble-${msg.role}`}>
                    {msg.role === 'user' ? (
                      <span className="qa-chat-user-text">{msg.content}</span>
                    ) : (
                      <>
                        <div className="qa-answer-markdown">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                          <p className="qa-chat-sources">Sources: {msg.sources.length} chunk(s)</p>
                        )}
                        {msg.agent_steps && msg.agent_steps.length > 0 && (
                          <details className="qa-agent-steps" style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                            <summary style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                              Agent steps ({msg.agent_steps.length})
                            </summary>
                            <ol style={{ margin: 'var(--space-2) 0 0', paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                              {msg.agent_steps.map((s) => (
                                <li key={s.step}>
                                  <strong>{s.tool}</strong>
                                  {s.detail ? ` — ${s.detail}` : ''}
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {qaLoading && (
                  <div className="qa-chat-bubble qa-chat-bubble-assistant">
                    <Loader2 size={18} className="spinner" />
                    <span>Thinking…</span>
                  </div>
                )}
              </div>
              <div className="input-group" style={{ marginTop: 'var(--space-3)' }}>
                <input
                  type="text"
                  placeholder="e.g. What does HIPAA say about encryption? How many tasks did we extract?"
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQaAsk()}
                />
                <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }} onClick={handleQaAsk} disabled={qaLoading}>
                  {qaLoading ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
                  Ask
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

function SettingsPage({
  isDemoMode,
  onResetAll,
  onSignOut,
  loading,
  jiraProject,
  setJiraProject,
  jiraUrl,
  setJiraUrl,
  jiraEmail,
  setJiraEmail,
  jiraToken,
  setJiraToken,
  ghRepo,
  setGhRepo,
  ghToken,
  setGhToken,
}: {
  isDemoMode: boolean
  onResetAll: () => void
  onSignOut: () => void | Promise<void>
  loading: boolean
  jiraProject: string
  setJiraProject: (v: string) => void
  jiraUrl: string
  setJiraUrl: (v: string) => void
  jiraEmail: string
  setJiraEmail: (v: string) => void
  jiraToken: string
  setJiraToken: (v: string) => void
  ghRepo: string
  setGhRepo: (v: string) => void
  ghToken: string
  setGhToken: (v: string) => void
}) {
  return (
    <>
      <div className="settings-cards">
        <ComplianceScannerGithubSettings isDemoMode={isDemoMode} />
        <div className="card">
          <h3 className="settings-card-title">
            <ShieldCheck size={18} aria-hidden />
            Account
          </h3>
          <p className="settings-card-desc">
            Sign out of RegTranslate and end your GitHub session (PDF workflow and scanner).
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => onSignOut()}>
            Sign out
          </button>
        </div>
        <div className="card">
          <h3 className="settings-card-title">
            <FileCode size={18} aria-hidden />
            Jira
          </h3>
          <p className="settings-card-desc">
            Used for exports from the PDF workflow and Compliance Scanner.
          </p>
          <div className="input-group">
            <Tooltip content="Jira project key (e.g. PROJ)">
              <label htmlFor="settings-jira-project">Project key</label>
            </Tooltip>
            <input id="settings-jira-project" type="text" value={jiraProject} onChange={(e) => setJiraProject(e.target.value)} placeholder="PROJ" />
          </div>
          <div className="input-group">
            <Tooltip content="Your Atlassian Jira instance URL">
              <label htmlFor="settings-jira-url">URL</label>
            </Tooltip>
            <input id="settings-jira-url" type="text" value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} placeholder="https://your-domain.atlassian.net" />
          </div>
          <div className="input-group">
            <Tooltip content="Email you use to sign in to Jira">
              <label htmlFor="settings-jira-email">Email</label>
            </Tooltip>
            <input id="settings-jira-email" type="text" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div className="input-group">
            <Tooltip content="From your Atlassian account, if your Jira site requires it.">
              <label htmlFor="settings-jira-token">Jira credential</label>
            </Tooltip>
            <input id="settings-jira-token" type="password" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} placeholder="••••••••" autoComplete="off" />
          </div>
        </div>
        <div className="card">
          <h3 className="settings-card-title">
            <Github size={18} aria-hidden />
            GitHub
          </h3>
          <p className="settings-card-desc">
            Repository and credential for creating issues from export.
          </p>
          <div className="input-group">
            <Tooltip content="Repository as owner/name (e.g. owner/repo)">
              <label htmlFor="settings-gh-repo">Repository</label>
            </Tooltip>
            <input id="settings-gh-repo" type="text" value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} placeholder="owner/repo" />
          </div>
          <div className="input-group">
            <Tooltip content="GitHub credential for repository exports.">
              <label htmlFor="settings-gh-token">GitHub credential</label>
            </Tooltip>
            <input id="settings-gh-token" type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="••••••••" autoComplete="off" />
          </div>
        </div>
        <div className="card">
          <h3 className="settings-card-title">Clear all data</h3>
          <p className="settings-card-desc">
            Removes documents, tasks, audit logs, export history, regulation versions, and calibration data. You can&apos;t undo this.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onResetAll}
            disabled={loading}
            style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
          >
            {loading ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
            {loading ? 'Clearing…' : 'Clear all data'}
          </button>
        </div>
      </div>
    </>
  )
}

function AuditPage({
  entries,
}: {
  entries: Array<{ timestamp: string; user_id: string; action: string; resource_accessed: string; source_ip: string; details: string }>
}) {
  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ts
    }
  }
  return (
    <>
      {entries.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No audit entries yet.</p>
        </div>
      ) : (
        <div className="audit-list">
          {entries.map((e, i) => (
            <div key={i} className="audit-card">
              <div className="audit-card-header">
                <span className="audit-badge">{e.action}</span>
                <span className="audit-date">{formatDate(e.timestamp)}</span>
              </div>
              <div className="audit-card-body">
                <div className="audit-meta">User: <strong>{e.user_id}</strong> · Resource: <code>{e.resource_accessed}</code></div>
                {e.details && <div className="audit-details">{e.details}</div>}
                <div className="audit-meta">IP: {e.source_ip}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function HistoryPage({
  entries,
}: {
  entries: Array<{ timestamp: string; target: string; project_key?: string; repo?: string; keys?: string[]; urls?: string[]; task_count: number; jira_url?: string }>
}) {
  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleString()
    } catch {
      return ts
    }
  }

  return (
    <>
      {entries.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No export history yet. Create Jira tickets or GitHub issues to see them here.</p>
        </div>
      ) : (
        <div className="history-list">
          {entries.map((e, i) => (
            <div key={i} className="history-card">
              <div className="history-card-header">
                <span className={`history-badge ${e.target}`}>
                  {e.target === 'jira' ? <FileCode size={14} /> : <Github size={14} />}
                  {e.target === 'jira' ? 'Jira' : 'GitHub'}
                </span>
                <span className="history-date">{formatDate(e.timestamp)}</span>
              </div>
              <div className="history-card-body">
                {e.target === 'jira' && (
                  <>
                    <div className="history-meta">Project: <strong>{e.project_key}</strong> · {e.task_count} task(s)</div>
                    <div className="history-keys">
                      {e.keys?.map((k) => (
                        <a
                          key={k}
                          href={`${e.jira_url || 'https://your-domain.atlassian.net'}/browse/${k}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="history-link"
                        >
                          {k}
                          <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  </>
                )}
                {e.target === 'github' && (
                  <>
                    <div className="history-meta">Repo: <strong>{e.repo}</strong> · {e.task_count} task(s)</div>
                    <div className="history-urls">
                      {e.urls?.slice(0, 5).map((u, j) => (
                        <a key={j} href={u} target="_blank" rel="noopener noreferrer" className="history-link">
                          Issue {j + 1}
                          <ExternalLink size={12} />
                        </a>
                      ))}
                      {e.urls && e.urls.length > 5 && (
                        <span className="history-more">+{e.urls.length - 5} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function TaskCard({
  task,
  selected,
  onToggle,
  onUpdate,
  onDelete,
  onCopyMarkdown,
  onCalibrationFeedback,
  expandIn,
}: {
  task: ExtractionTask
  selected: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<ExtractionTask>) => void
  onDelete?: () => void
  onCopyMarkdown?: () => void
  onCalibrationFeedback?: (taskId: string, title: string, correct: boolean) => void
  expandIn?: number
}) {
  const ac = task.acceptance_criteria ?? []
  const subs = task.subtasks ?? []
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (expandIn != null && expandIn > 0) {
      const t = setTimeout(() => setExpanded(true), expandIn)
      return () => clearTimeout(t)
    }
  }, [expandIn])
  const [editing, setEditing] = useState(false)
  const evidenceLinks = task.evidence_links ?? []
  const [editForm, setEditForm] = useState({
    title: task.title ?? '',
    description: task.description ?? '',
    priority: task.priority ?? 'Medium',
    responsible_role: task.responsible_role ?? '',
    acceptance_criteria: ac.join('\n'),
    subtasks: subs.map((s) => `${s?.title ?? ''} | ${s?.description ?? ''}`).join('\n'),
    evidence_links: evidenceLinks.map((e) => `${e.url} | ${e.label || ''}`).join('\n'),
  })

  const handleSave = () => {
    const ac = editForm.acceptance_criteria
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const sub = editForm.subtasks
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return { title: '', description: '' }
        if (trimmed.includes(' | ')) {
          const [t, d] = trimmed.split(' | ', 2)
          return { title: t.trim(), description: d.trim() }
        }
        return { title: trimmed, description: '' }
      })
      .filter((s) => s.title)
    const ev = editForm.evidence_links
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return null
        if (trimmed.includes(' | ')) {
          const [url, label] = trimmed.split(' | ', 2)
          return { url: url.trim(), label: label?.trim() || '' }
        }
        return { url: trimmed, label: '' }
      })
      .filter((x): x is { url: string; label: string } => x != null && !!x.url)
    onUpdate({
      title: editForm.title,
      description: editForm.description,
      priority: editForm.priority as ExtractionTask['priority'],
      responsible_role: editForm.responsible_role,
      acceptance_criteria: ac,
      subtasks: sub,
      evidence_links: ev,
    })
    setEditing(false)
  }

  return (
    <div className={`task-card ${expanded ? 'expanded' : ''}`}>
      <div
        className="task-card-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${task.title}, ${task.priority} priority`}
      >
        <Tooltip content={selected ? 'Exclude from export' : 'Include in export'}>
        <input
          type="checkbox"
          className="task-card-checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${task.title}`}
        />
        </Tooltip>
        <span className="task-card-title">{task.title}</span>
        {task.confidence != null && (
          <span className="task-card-confidence" title={`Confidence: ${task.confidence}%`}>
            {task.confidence}%
          </span>
        )}
        <span className={`task-card-badge ${task.priority}`}>{task.priority}</span>
        <ChevronDown size={18} className="task-card-chevron" />
      </div>
      {expanded && (
        <div className="task-card-body">
          <div className="task-card-desc">{task.description}</div>
          <div className="task-card-source">
            <strong>Source citation:</strong> {task.source_citation}
          </div>
          {(ac.length > 0) && (
            <>
              <strong style={{ fontSize: 'var(--text-xs)' }}>Acceptance criteria</strong>
              <ul className="task-card-list">
                {ac.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {(subs.length > 0) && (
            <>
              <strong style={{ fontSize: 'var(--text-xs)' }}>Subtasks</strong>
              <ul className="task-card-list">
                {subs.map((s, i) => (
                  <li key={i}>
                    <strong>{s?.title ?? ''}</strong>
                    {(s?.description) && ` — ${s.description}`}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="task-card-meta">Role: {task.responsible_role}</div>
          {evidenceLinks.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <strong style={{ fontSize: 'var(--text-xs)' }}>Evidence</strong>
              <ul className="task-card-list">
                {evidenceLinks.map((e, i) => (
                  <li key={i}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.label || e.url}</a></li>
                ))}
              </ul>
            </div>
          )}
          {onCalibrationFeedback && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCalibrationFeedback(task.task_id, task.title, true)} title="Correct">👍</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCalibrationFeedback(task.task_id, task.title, false)} title="Incorrect">👎</button>
            </div>
          )}

          {!editing ? (
            <div className="task-card-actions">
            {onCopyMarkdown && (
              <Tooltip content="Copy as Markdown">
                <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onCopyMarkdown(); }}>
                  <Copy size={14} />
                  Copy Markdown
                </button>
              </Tooltip>
            )}
            <Tooltip content="Edit task details before exporting">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(true)}
            >
              <Pencil size={14} />
              Edit task
            </button>
            </Tooltip>
            {onDelete && (
              <Tooltip content="Delete task">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--error)' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </Tooltip>
            )}
            </div>
          ) : (
            <div className="edit-form">
              <div className="input-group">
                <label>Title</label>
                <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="input-group">
                <label>Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value as ExtractionTask['priority'] }))}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="input-group">
                <label>Responsible role</label>
                <input value={editForm.responsible_role} onChange={(e) => setEditForm((f) => ({ ...f, responsible_role: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Acceptance criteria (one per line)</label>
                <textarea value={editForm.acceptance_criteria} onChange={(e) => setEditForm((f) => ({ ...f, acceptance_criteria: e.target.value }))} rows={2} />
              </div>
              <div className="input-group">
                <label>Subtasks (Title | Description per line)</label>
                <textarea value={editForm.subtasks} onChange={(e) => setEditForm((f) => ({ ...f, subtasks: e.target.value }))} rows={2} />
              </div>
              <div className="input-group">
                <label>Evidence links (URL | Label per line)</label>
                <textarea value={editForm.evidence_links} onChange={(e) => setEditForm((f) => ({ ...f, evidence_links: e.target.value }))} rows={2} placeholder="https://... | Screenshot" />
              </div>
              <div className="edit-form-actions">
                <button className="btn btn-primary btn-sm" onClick={handleSave}>
                  <Check size={14} />
                  Save
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
