import type { ExtractionTask, ExtractResponse, ProcessResponse } from './types'

const API_BASE = '/api'

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
  doc_id: string
  regulation_name: string
  dedupe?: boolean
  return_coverage?: boolean
  product_context?: string | null
  rag_query?: string | null
}): Promise<ExtractResponse> {
  return fetchApi<ExtractResponse>('/extract', {
    method: 'POST',
    body: JSON.stringify({
      doc_id: params.doc_id,
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

// --- Compliance Q&A agent ---
export async function qaAsk(docId: string, question: string): Promise<{ answer: string; sources: Array<{ text: string; page: string | number; section: string }> }> {
  return fetchApi('/qa', { method: 'POST', body: JSON.stringify({ doc_id: docId, question }) })
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
