import type { Location } from 'react-router-dom'

/** Safe post-auth path from router location (`state.from`, then `?next=`, else default). */
export function getPostAuthRedirectPath(location: Location, defaultPath = '/dashboard'): string {
  const fromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  const nextQuery = new URLSearchParams(location.search).get('next')
  const safeNext =
    nextQuery && nextQuery.startsWith('/') && !nextQuery.startsWith('//') ? nextQuery : null
  return (
    (fromState && fromState.startsWith('/') && !fromState.startsWith('//') ? fromState : null) ||
    safeNext ||
    defaultPath
  )
}
