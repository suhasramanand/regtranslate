import type { ExtractionTask, ExtractResponse, ProcessResponse } from './types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export interface FlowStage {
  id: string
  title: string
  desc: string
  duration_ms: number
  details?: string[]
}

export async function getFlowStages(): Promise<{ stages: FlowStage[] }> {
  return fetchApi<{ stages: FlowStage[] }>('/demo/flow-stages')
}

export async function getJiraConfig(): Promise<{ url: string; email: string; api_token: string }> {
  return fetchApi<{ url: string; email: string; api_token: string }>('/config/jira')
}

export interface ExportConfig {
  jira: { url: string; email: string; api_token: string }
  github: { repo: string; token: string }
}

export async function getExportConfig(): Promise<ExportConfig> {
  return fetchApi<ExportConfig>('/config/export')
}

export interface ExportHistoryEntry {
  timestamp: string
  target: 'jira' | 'github'
  project_key?: string
  repo?: string
  keys?: string[]
  urls?: string[]
  task_count: number
  jira_url?: string
}

export async function getExportHistory(limit?: number): Promise<{ entries: ExportHistoryEntry[] }> {
  const q = limit != null ? `?limit=${limit}` : ''
  return fetchApi<{ entries: ExportHistoryEntry[] }>(`/history/export${q}`)
}

export interface AuditLogEntry {
  timestamp: string
  user_id: string
  action: string
  resource_accessed: string
  source_ip: string
  details: string
  entry_hash?: string
}

export async function getAuditLogs(limit?: number, since?: string): Promise<{ entries: AuditLogEntry[] }> {
  const params = new URLSearchParams()
  if (limit != null) params.set('limit', String(limit))
  if (since) params.set('since', since)
  const q = params.toString() ? `?${params}` : ''
  return fetchApi<{ entries: AuditLogEntry[] }>(`/audit/logs${q}`)
}

export async function appendAuditLog(params: {
  user_id: string
  action: string
  resource_accessed: string
  source_ip?: string
  details?: string
}): Promise<{ ok: boolean; entry_hash: string }> {
  return fetchApi<{ ok: boolean; entry_hash: string }>('/audit/log', {
    method: 'POST',
    body: JSON.stringify({
      user_id: params.user_id,
      action: params.action,
      resource_accessed: params.resource_accessed,
      source_ip: params.source_ip ?? '',
      details: params.details ?? '',
    }),
  })
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail ?? err.message ?? res.statusText
    throw new Error(Array.isArray(msg) ? msg.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ') : String(msg))
  }
  return res.json()
}

export async function processDocument(
  file: File,
  regulationName: string = 'Custom'
): Promise<ProcessResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/process?regulation_name=${encodeURIComponent(regulationName)}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail ?? err.message ?? res.statusText
    throw new Error(Array.isArray(msg) ? msg.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ') : String(msg))
  }
  return res.json()
}

export async function extractTasks(params: {
  doc_id?: string
  doc_ids?: string[]
  regulation_name: string
  dedupe?: boolean
  return_coverage?: boolean
  product_context?: string | null
  rag_query?: string | null
}): Promise<ExtractResponse> {
  const ids = params.doc_ids ?? (params.doc_id ? [params.doc_id] : [])
  return fetchApi<ExtractResponse>('/extract', {
    method: 'POST',
    body: JSON.stringify({
      doc_id: ids[0] ?? '',
      doc_ids: ids.length > 0 ? ids : undefined,
      regulation_name: params.regulation_name,
      dedupe: params.dedupe ?? true,
      return_coverage: params.return_coverage ?? true,
      product_context: params.product_context ?? null,
      rag_query: params.rag_query ?? null,
    }),
  })
}

export async function exportToJira(params: {
  tasks: ExtractionTask[]
  project_key: string
  url?: string | null
  email?: string | null
  api_token?: string | null
  sprint_id?: number | null
  board_id?: number | null
  auto_create_sprint?: boolean
  assignee_overrides?: Record<string, string> | null
}): Promise<{ keys: string[] }> {
  return fetchApi<{ keys: string[] }>('/export/jira', {
    method: 'POST',
    body: JSON.stringify({
      tasks: params.tasks,
      project_key: params.project_key,
      url: params.url ?? null,
      email: params.email ?? null,
      api_token: params.api_token ?? null,
      sprint_id: params.sprint_id ?? null,
      board_id: params.board_id ?? null,
      auto_create_sprint: params.auto_create_sprint ?? false,
      assignee_overrides: params.assignee_overrides ?? null,
    }),
  })
}

export async function exportToGitHub(params: {
  tasks: ExtractionTask[]
  repo: string
  token: string
}): Promise<{ urls: string[] }> {
  return fetchApi<{ urls: string[] }>('/export/github', {
    method: 'POST',
    body: JSON.stringify({
      tasks: params.tasks,
      repo: params.repo,
      token: params.token,
    }),
  })
}

// --- Regulation version tracking ---
export async function getRegulationVersions(regulationName?: string, limit?: number): Promise<{ versions: Array<{ doc_id: string; regulation_name: string; source_filename: string; content_hash: string; processed_at: string; version_label: string; chunk_count: number }> }> {
  const params = new URLSearchParams()
  if (regulationName) params.set('regulation_name', regulationName)
  if (limit != null) params.set('limit', String(limit))
  const q = params.toString() ? `?${params}` : ''
  return fetchApi(`/regulation/versions${q}`)
}

export async function checkRegulationUpdate(docId: string, file: File): Promise<{ needs_update: boolean; current_hash?: string; new_hash: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/regulation/check-update?doc_id=${encodeURIComponent(docId)}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

export async function checkRegulationContentChange(
  file: File,
  regulationName: string,
): Promise<{ content_changed: boolean; previous_processed_at: string | null }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(
    `${API_BASE}/regulation/check-content-change?regulation_name=${encodeURIComponent(regulationName)}`,
    { method: 'POST', body: formData },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

// --- Compliance Q&A agent ---
export interface QAScreenContext {
  regulation_name?: string
  task_count?: number
  tasks?: Array<{ title: string; priority?: string }>
  coverage?: { chunk_count?: number; pages_summary?: string; sections?: string[] }
  recent_exports?: Array<{
    target: string
    task_count: number
    project_key?: string
    keys?: string[]
    timestamp?: string
  }>
}

export async function qaAsk(
  docId: string,
  question: string,
  screenContext?: QAScreenContext | null
): Promise<{ answer: string; sources: Array<{ text: string; page: string | number; section: string }> }> {
  return fetchApi('/qa', {
    method: 'POST',
    body: JSON.stringify({ doc_id: docId, question, screen_context: screenContext ?? undefined }),
  })
}

// --- Cross-regulation gap analysis ---
export async function gapAnalysis(params: { tasks_a: ExtractionTask[]; tasks_b: ExtractionTask[]; label_a?: string; label_b?: string }): Promise<{
  overlap: Array<{ task_a: ExtractionTask; task_b: ExtractionTask; similarity: number }>
  unique_to_a: ExtractionTask[]
  unique_to_b: ExtractionTask[]
  label_a: string
  label_b: string
}> {
  return fetchApi('/gap-analysis', {
    method: 'POST',
    body: JSON.stringify({
      tasks_a: params.tasks_a,
      tasks_b: params.tasks_b,
      label_a: params.label_a ?? 'A',
      label_b: params.label_b ?? 'B',
    }),
  })
}

// --- Confidence calibration ---
export async function submitCalibrationFeedback(taskId: string, title: string, correct: boolean): Promise<{ ok: boolean }> {
  return fetchApi('/calibration/feedback', { method: 'POST', body: JSON.stringify({ task_id: taskId, title, correct }) })
}

export async function getCalibrationStats(): Promise<{ total_feedback_entries: number; tasks_with_feedback: number; average_accuracy: number }> {
  return fetchApi('/calibration/stats')
}

export async function resetAllData(): Promise<{ ok: boolean; cleared: string[] }> {
  return fetchApi<{ ok: boolean; cleared: string[] }>('/settings/reset-all', {
    method: 'POST',
  })
}

// --- Compliance Scanner API ---

export const SCANNER_API_BASE = import.meta.env.VITE_SCANNER_API_URL || 'http://127.0.0.1:9010'

async function fetchScannerApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SCANNER_API_BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail ?? err.message ?? res.statusText
    throw new Error(Array.isArray(msg) ? msg.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ') : String(msg))
  }
  return res.json()
}

export interface ScannerRun {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  org_source: { org: string; provider: 'github' }
  repos: Array<{ full_name: string; default_branch: string; commit_sha: string }>
  counts: {
    repos_total: number
    repos_done: number
    files_indexed: number
    chunks_indexed: number
    controls_total: number
    controls_done: number
    findings_total: number
    findings_non_compliant: number
    findings_unknown: number
  }
}

export interface ScannerFinding {
  control_id: string
  control_title: string
  status: 'compliant' | 'non_compliant' | 'unknown'
  confidence?: number | null
  summary: string
  gap_description: string
  acceptance_criteria: string[]
  evidence_links: Array<{ url: string; label?: string }>
  evidence_snippets: Array<{ path?: string; start_line?: number; end_line?: number; why?: string; preview?: string }>
}

export async function scannerStartOrgScan(params: {
  org: string
  repos?: string[] | null
  selected_repos?: Array<{ full_name: string; default_branch: string }> | null
  github_token?: string | null
  scan_all_org?: boolean
}): Promise<{ run_id: string; status: ScannerRun['status'] }> {
  const headers: Record<string, string> = {}
  if (params.github_token?.trim()) {
    headers['X-Scanner-GitHub-Token'] = params.github_token.trim()
  }
  const scanAll = params.scan_all_org === true
  return fetchScannerApi('/org-scan/start', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      org: params.org,
      repos: scanAll ? null : params.repos ?? null,
      selected_repos: scanAll ? null : params.selected_repos ?? null,
      config: { github_token: params.github_token ?? undefined },
    }),
  })
}

export async function scannerGithubStatus(): Promise<{
  oauth_configured: boolean
  client_id: string | null
  redirect_uri: string
}> {
  return fetchScannerApi('/auth/github/status')
}

export async function scannerGithubSession(): Promise<{
  connected: boolean
  login?: string
  avatar_url?: string | null
  oauth_configured: boolean
  session_source?: string
}> {
  return fetchScannerApi('/github/session')
}

export async function scannerGithubPatLogin(token: string): Promise<{ ok: boolean; login: string }> {
  return fetchScannerApi('/auth/github/pat', {
    method: 'POST',
    body: JSON.stringify({ token: token.trim() }),
  })
}

export async function scannerGithubOrgs(githubToken?: string | null): Promise<{ orgs: string[] }> {
  const headers: Record<string, string> = {}
  if (githubToken?.trim()) headers['X-Scanner-GitHub-Token'] = githubToken.trim()
  return fetchScannerApi('/github/orgs', { headers })
}

export async function scannerGithubOrgRepos(
  org: string,
  opts?: { limit?: number; githubToken?: string | null },
): Promise<{
  repos: Array<{ full_name: string; default_branch: string; private: boolean; description: string }>
}> {
  const headers: Record<string, string> = {}
  if (opts?.githubToken?.trim()) headers['X-Scanner-GitHub-Token'] = opts.githubToken.trim()
  const q = opts?.limit != null ? `?limit=${encodeURIComponent(String(opts.limit))}` : ''
  return fetchScannerApi(`/github/orgs/${encodeURIComponent(org)}/repos${q}`, { headers })
}

export async function scannerGithubDisconnect(): Promise<{ ok: boolean }> {
  return fetchScannerApi('/auth/github/disconnect', { method: 'POST', body: JSON.stringify({}) })
}

export async function scannerGetRun(runId: string): Promise<ScannerRun> {
  return fetchScannerApi(`/runs/${encodeURIComponent(runId)}`)
}

export async function scannerGetFindings(runId: string): Promise<{ findings: ScannerFinding[] }> {
  return fetchScannerApi(`/runs/${encodeURIComponent(runId)}/findings`)
}

export async function scannerExportToJira(params: {
  run_id: string
  project_key: string
  url?: string | null
  email?: string | null
  api_token?: string | null
  only_non_compliant?: boolean
}): Promise<{ keys: string[] }> {
  return fetchScannerApi(`/runs/${encodeURIComponent(params.run_id)}/export/jira`, {
    method: 'POST',
    body: JSON.stringify({
      project_key: params.project_key,
      url: params.url ?? null,
      email: params.email ?? null,
      api_token: params.api_token ?? null,
      only_non_compliant: params.only_non_compliant ?? true,
    }),
  })
}
