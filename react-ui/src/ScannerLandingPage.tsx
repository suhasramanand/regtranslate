import { Link } from 'react-router-dom'
import {
  FileText,
  ArrowRight,
  Github,
  Moon,
  Sun,
  ScanSearch,
  GitBranch,
  Database,
  FileWarning,
  Share2,
  Shield,
  Bot,
  FileCode,
  CheckCircle2,
} from 'lucide-react'
import { useTheme } from './useTheme'
import { MarketingFooter } from './MarketingFooter'
import './ScannerLandingPage.css'

export function ScannerLandingPage() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="scanner-lp">
      <header className="scanner-lp-header">
        <div className="scanner-lp-header-inner">
          <div className="scanner-lp-header-left">
            <Link to="/" className="scanner-lp-brand-home" aria-label="RegTranslate home">
              <FileText size={18} strokeWidth={2} aria-hidden />
            </Link>
            <span className="scanner-lp-header-divider" aria-hidden />
            <span className="scanner-lp-product">Compliance Scanner</span>
          </div>
          <nav className="scanner-lp-nav" aria-label="Site">
            <Link to="/" className="scanner-lp-nav-link">
              Home
            </Link>
            <Link to="/dashboard?demo=1" className="scanner-lp-nav-link">
              Demo
            </Link>
            <Link to="/login?next=/scanner/app" className="scanner-lp-nav-link scanner-lp-nav-link--emphasis">
              Sign in
            </Link>
          </nav>
          <button
            type="button"
            className="scanner-lp-theme"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="scanner-lp-main" id="main-content">
        <div className="scanner-lp-shell">
          <section className="scanner-lp-hero" aria-labelledby="scanner-lp-heading">
            <div className="scanner-lp-hero-copy">
              <p className="scanner-lp-eyebrow">
                <ScanSearch size={14} strokeWidth={2} aria-hidden />
                Repository-level compliance checks
              </p>
              <h1 id="scanner-lp-heading" className="scanner-lp-title">
                Scan your org&apos;s code against
                <span className="scanner-lp-title-accent"> control catalogs</span>
              </h1>
              <p className="scanner-lp-subtitle">
                Connect GitHub, choose repositories, and run automated evaluations across your codebase. Review findings
                with clear evidence, export to Jira, and feed results into pipelines and security workflows — in one
                place.
              </p>
              <div className="scanner-lp-cta-row">
                <Link to="/login?next=/scanner/app" className="scanner-lp-cta scanner-lp-cta--primary">
                  <Github size={18} strokeWidth={2} aria-hidden />
                  Sign in to run scans
                </Link>
                <Link to="/" className="scanner-lp-cta scanner-lp-cta--secondary">
                  Back to home
                  <ArrowRight size={18} strokeWidth={2} aria-hidden />
                </Link>
              </div>
              <p className="scanner-lp-note">
                Sign in with GitHub to connect your organization and start scanning.{' '}
                <Link to="/login?next=/scanner/app" className="scanner-lp-inline-link">
                  Continue to sign-in
                </Link>
              </p>
            </div>
            <div className="scanner-lp-hero-visual" aria-hidden>
              <div className="scanner-lp-ad">
                <div className="scanner-lp-ad-chrome">
                  <span className="scanner-lp-ad-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <div className="scanner-lp-ad-url">RegTranslate · Automated compliance scan</div>
                </div>
                <div className="scanner-lp-ad-flow">
                  <div className="scanner-lp-ad-pane scanner-lp-ad-pane--source">
                    <span className="scanner-lp-ad-pane-label">Code</span>
                    <div className="scanner-lp-ad-repo">
                      <GitBranch size={14} strokeWidth={2} aria-hidden />
                      <span>acme / platform-api</span>
                    </div>
                    <div className="scanner-lp-ad-files">
                      <div className="scanner-lp-ad-file-row">
                        <FileCode size={12} strokeWidth={2} aria-hidden />
                        <span className="scanner-lp-ad-file-lines" />
                      </div>
                      <div className="scanner-lp-ad-file-row">
                        <FileCode size={12} strokeWidth={2} aria-hidden />
                        <span className="scanner-lp-ad-file-lines scanner-lp-ad-file-lines--mid" />
                      </div>
                      <div className="scanner-lp-ad-file-row">
                        <FileCode size={12} strokeWidth={2} aria-hidden />
                        <span className="scanner-lp-ad-file-lines scanner-lp-ad-file-lines--short" />
                      </div>
                      <div className="scanner-lp-ad-scan-sweep" />
                    </div>
                  </div>

                  <div className="scanner-lp-ad-arrow" aria-hidden>
                    <ArrowRight size={18} strokeWidth={2} />
                  </div>

                  <div className="scanner-lp-ad-pane scanner-lp-ad-pane--agent">
                    <div className="scanner-lp-ad-agent-glow" />
                    <div className="scanner-lp-ad-agent-badge">
                      <Bot size={22} strokeWidth={2} aria-hidden />
                    </div>
                    <p className="scanner-lp-ad-agent-kicker">AI compliance agent</p>
                    <p className="scanner-lp-ad-agent-title">Scanning controls</p>
                    <p className="scanner-lp-ad-agent-meta">
                      <ScanSearch size={12} strokeWidth={2} aria-hidden />
                      Evidence &amp; citations
                    </p>
                  </div>

                  <div className="scanner-lp-ad-arrow" aria-hidden>
                    <ArrowRight size={18} strokeWidth={2} />
                  </div>

                  <div className="scanner-lp-ad-pane scanner-lp-ad-pane--out">
                    <span className="scanner-lp-ad-pane-label">Work</span>
                    <div className="scanner-lp-ad-jira-card">
                      <div className="scanner-lp-ad-jira-brand">Jira</div>
                      <div className="scanner-lp-ad-jira-line" />
                      <div className="scanner-lp-ad-jira-line scanner-lp-ad-jira-line--short" />
                    </div>
                    <div className="scanner-lp-ad-done">
                      <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
                      <span>Finding routed to ticket</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="scanner-lp-features" aria-labelledby="scanner-lp-features-heading">
            <h2 id="scanner-lp-features-heading" className="scanner-lp-features-heading">
              What you get
            </h2>
            <ul className="scanner-lp-feature-grid">
              <li className="scanner-lp-feature">
                <span className="scanner-lp-feature-icon">
                  <GitBranch size={20} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="scanner-lp-feature-title">GitHub-first</h3>
                <p className="scanner-lp-feature-text">
                  Sign in with GitHub, browse organizations and repositories, and prepare code for policy checks.
                </p>
              </li>
              <li className="scanner-lp-feature">
                <span className="scanner-lp-feature-icon">
                  <Database size={20} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="scanner-lp-feature-title">Deep code understanding</h3>
                <p className="scanner-lp-feature-text">
                  Intelligent indexing so every finding points to real files, paths, and commits — not guesswork.
                </p>
              </li>
              <li className="scanner-lp-feature">
                <span className="scanner-lp-feature-icon">
                  <Shield size={20} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="scanner-lp-feature-title">Control catalog</h3>
                <p className="scanner-lp-feature-text">
                  Map findings to your policy controls with structured status and evidence links.
                </p>
              </li>
              <li className="scanner-lp-feature">
                <span className="scanner-lp-feature-icon">
                  <FileWarning size={20} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="scanner-lp-feature-title">Pipelines &amp; dashboards</h3>
                <p className="scanner-lp-feature-text">
                  Ship results into the checks and security tools your team already uses.
                </p>
              </li>
              <li className="scanner-lp-feature">
                <span className="scanner-lp-feature-icon">
                  <Share2 size={20} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="scanner-lp-feature-title">Jira export</h3>
                <p className="scanner-lp-feature-text">
                  Open issues for non-compliant gaps with titles, descriptions, and permalinks to code.
                </p>
              </li>
            </ul>
          </section>

          <section className="scanner-lp-bottom-cta" aria-label="Get started">
            <p className="scanner-lp-bottom-cta-text">Ready to connect your org?</p>
            <Link to="/login?next=/scanner/app" className="scanner-lp-cta scanner-lp-cta--primary">
              Open Compliance Scanner
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
            </Link>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}