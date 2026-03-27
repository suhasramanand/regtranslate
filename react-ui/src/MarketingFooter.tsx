import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './MarketingFooter.css'

function HashLink({ hash, children }: { hash: string; children: ReactNode }) {
  return (
    <Link to={{ pathname: '/', hash }} replace={false}>
      {children}
    </Link>
  )
}

export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-inner">
        <div className="mkt-footer-grid">
          <div className="mkt-footer-brand-block">
            <Link to="/" className="mkt-footer-logo">
              <span className="mkt-footer-logo-reg">Reg</span>
              <span className="mkt-footer-logo-translate">Translate</span>
            </Link>
            <p className="mkt-footer-tagline">
              Compliance automation for engineering teams. PDFs in, structured work out.
            </p>
          </div>

          <div>
            <h2 className="mkt-footer-col-title">Product</h2>
            <ul className="mkt-footer-links">
              <li>
                <HashLink hash="capabilities">Features</HashLink>
              </li>
              <li>
                <HashLink hash="how-it-works">How It Works</HashLink>
              </li>
              <li>
                <HashLink hash="pricing">Pricing</HashLink>
              </li>
              <li>
                <Link to="/changelog">Changelog</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mkt-footer-col-title">Company</h2>
            <ul className="mkt-footer-links">
              <li>
                <Link to="/about">About</Link>
              </li>
              <li>
                <Link to="/blog">Blog</Link>
              </li>
              <li>
                <Link to="/careers">Careers</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mkt-footer-col-title">Legal</h2>
            <ul className="mkt-footer-links">
              <li>
                <Link to="/privacy">Privacy</Link>
              </li>
              <li>
                <Link to="/terms">Terms</Link>
              </li>
              <li>
                <Link to="/security">Security</Link>
              </li>
              <li>
                <Link to="/status">Status</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mkt-footer-bottom">
        <p className="mkt-footer-copy">© {year} RegTranslate, Inc. All rights reserved.</p>
        <p className="mkt-footer-aside">14-day free trial</p>
      </div>
    </footer>
  )
}
