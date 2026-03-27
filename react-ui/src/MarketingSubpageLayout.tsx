import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MarketingFooter } from './MarketingFooter'
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
      <header className="mkt-sub-header">
        <div className="mkt-sub-header-inner">
          <Link to="/" className="mkt-sub-brand">
            <span className="mkt-sub-brand-reg">Reg</span>
            <span className="mkt-sub-brand-translate">Translate</span>
          </Link>
          <div className="mkt-sub-actions">
            <Link to="/login" className="mkt-sub-login">
              Log in
            </Link>
            <Link to="/dashboard?demo=1" className="mkt-sub-cta">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="mkt-sub-main" id="main-content">
        <h1 className="mkt-sub-title">{title}</h1>
        <div className="mkt-sub-prose">{children}</div>
      </main>

      <MarketingFooter />
    </div>
  )
}
