import { Outlet } from 'react-router-dom'
import { GithubSessionGate } from './GithubSessionGate'

/** Layout: child routes require email sign-in or a GitHub session from the compliance scanner. */
export function RequireAuth() {
  return (
    <GithubSessionGate>
      <Outlet />
    </GithubSessionGate>
  )
}
