/** Shared Jira export defaults for Dashboard + Compliance Scanner (localStorage). */
export const JIRA_EXPORT_PREFS_KEY = 'regtranslate-jira-export-prefs'

export type JiraExportPrefs = {
  project?: string
  url?: string
  email?: string
  token?: string
}

export function readJiraExportPrefs(): JiraExportPrefs {
  try {
    const raw = localStorage.getItem(JIRA_EXPORT_PREFS_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      project: typeof o.project === 'string' ? o.project : undefined,
      url: typeof o.url === 'string' ? o.url : undefined,
      email: typeof o.email === 'string' ? o.email : undefined,
      token: typeof o.token === 'string' ? o.token : undefined,
    }
  } catch {
    return {}
  }
}

export function writeJiraExportPrefs(next: Partial<JiraExportPrefs>) {
  const cur = readJiraExportPrefs()
  localStorage.setItem(JIRA_EXPORT_PREFS_KEY, JSON.stringify({ ...cur, ...next }))
}
