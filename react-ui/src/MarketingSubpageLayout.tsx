import type { ReactNode } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { SiteHeader } from './SiteHeader'
import './MarketingSubpageLayout.css'

export function MarketingSubpageLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mkt-sub">
      <SiteHeader variant="subpage" />

      <main className="mkt-sub-main" id="main-content">
        <h1 className="mkt-sub-title">{title}</h1>
        <div className="mkt-sub-prose">{children}</div>
      </main>

      <MarketingFooter />
    </div>
  )
}
