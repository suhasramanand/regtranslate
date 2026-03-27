import { useSearchParams } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import { GithubSessionGate } from './GithubSessionGate'

/** Public demo at /dashboard?demo=1; full dashboard requires a scanner GitHub session. */
export function DashboardRoute() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('demo') === '1') {
    return <Dashboard />
  }
  return (
    <GithubSessionGate>
      <Dashboard />
    </GithubSessionGate>
  )
}
