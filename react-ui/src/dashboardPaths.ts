/** Shared dashboard URLs so the pill nav stays consistent between /dashboard and /scanner/app. */

export type DashboardView = 'history' | 'audit' | 'settings'

export function dashboardPath(opts?: { demo?: boolean; view?: DashboardView }): string {
  const p = new URLSearchParams()
  if (opts?.demo) p.set('demo', '1')
  if (opts?.view) p.set('view', opts.view)
  const q = p.toString()
  return q ? `/dashboard?${q}` : '/dashboard'
}
