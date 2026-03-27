import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FileText,
  ArrowRight,
  Moon,
  Sun,
  Github,
  GitBranch,
  Shield,
  ChevronDown,
} from 'lucide-react'
import { useTheme } from './useTheme'
import { MarketingFooter } from './MarketingFooter'
import './HeroPage.css'

const FAQ_ITEMS = [
  {
    q: 'Which compliance frameworks do you support?',
    a: 'HIPAA, GDPR, FDA-style quality rules, accessibility standards like WCAG, and custom control catalogs your team defines. We help you map documents and code to the obligations that matter for your programs.',
  },
  {
    q: 'How does repo scanning work?',
    a: 'We connect to your GitHub or GitLab repos via a read-only token, scan for configuration, code patterns, and infrastructure-as-code files, then map findings to the requirements extracted from your compliance documents.',
  },
  {
    q: 'What integrations are available?',
    a: 'Jira, GitHub Issues, GitLab Issues, Linear, and Slack — with webhooks for custom pipelines. We also support SSO via SAML 2.0 and SCIM provisioning.',
  },
  {
    q: 'Can I customise the tickets pushed to Jira?',
    a: 'Yes. Project, fields, and issue content follow the structure you configure so tickets land in the format your program already uses.',
  },
  {
    q: 'Is my data secure?',
    a: 'Data stays within the boundaries you configure for your deployment. Use your own hosting and identity providers to meet internal security and audit requirements.',
  },
]

const MOCK_FINDINGS = [
  { id: 'SOX-404', title: 'Internal control gap', priority: 'high' as const },
  { id: 'GDPR-17', title: 'Erasure workflow', priority: 'medium' as const },
  { id: 'HIPAA-164', title: 'Access review cadence', priority: 'medium' as const },
  { id: 'WCAG-2.1', title: 'Form error association', priority: 'low' as const },
]

const SCAN_DOC_COUNT = 12

export function HeroPage() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  useEffect(() => {
    const id = location.hash?.replace(/^#/, '')
    if (!id || location.pathname !== '/') return
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.pathname, location.hash])

  return (
    <div className="hero hero--marketing">
      <header className="hero-header hero-header--marketing">
        <div className="hero-header-inner hero-header-inner--marketing">
          <Link to="/" className="hero-brand-split" aria-current="page">
            <span className="hero-brand-reg">Reg</span>
            <span className="hero-brand-translate">Translate</span>
          </Link>
          <nav className="hero-nav-center" aria-label="Product">
            <a href="#capabilities" className="hero-nav-site-link">
              Features
            </a>
            <a href="#how-it-works" className="hero-nav-site-link">
              How It Works
            </a>
            <a href="#pricing" className="hero-nav-site-link">
              Pricing
            </a>
            <a href="#faq" className="hero-nav-site-link">
              Docs
            </a>
          </nav>
          <div className="hero-header-actions">
            <Link to="/login" className="hero-nav-login">
              Log in
            </Link>
            <Link to="/dashboard?demo=1" className="hero-btn-get-started">
              Get Started
            </Link>
            <button
              type="button"
              className="hero-theme-toggle hero-theme-toggle--minimal"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="hero-main hero-main--marketing" id="main-content">
        <div className="hero-shell hero-shell--marketing">
          <section className="hero-hero hero-hero--split" aria-labelledby="hero-heading">
            <div className="hero-copy hero-copy--marketing">
              <p className="hero-eyebrow-marketing">Compliance automation</p>
              <h1 id="hero-heading" className="hero-title-marketing">
                Turn regulatory PDFs into <span className="hero-title-green">actionable work items</span>
              </h1>
              <p className="hero-subtitle-marketing">
                RegTranslate reads compliance documents, extracts obligations, maps them to your codebase, and pushes
                structured tasks straight to Jira or GitHub — so your team ships audit-ready instead of scrambling at
                deadline.
              </p>
              <div className="hero-cta-row-marketing">
                <Link to="/dashboard?demo=1" className="hero-cta-marketing hero-cta-marketing--primary">
                  Start Free Trial
                </Link>
                <a href="mailto:hello@regtranslate.com" className="hero-cta-marketing hero-cta-marketing--outline">
                  Book a Demo
                </a>
              </div>
              <p className="hero-micro-trust">
                No credit card required · <span className="hero-micro-trust-accent">14-day free trial</span>
              </p>
            </div>

            <div className="hero-mockup" aria-hidden>
              <div className="hero-mockup-window">
                <div className="hero-mockup-chrome">
                  <span className="hero-mockup-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <div className="hero-mockup-title">compliance-report-Q4.pdf → findings</div>
                </div>
                <ul className="hero-mockup-list">
                  {MOCK_FINDINGS.map((row) => (
                    <li key={row.id} className="hero-mockup-row">
                      <div className="hero-mockup-row-main">
                        <span className="hero-mockup-code">{row.id}</span>
                        <span className="hero-mockup-row-title">{row.title}</span>
                      </div>
                      <span className={`hero-mockup-priority hero-mockup-priority--${row.priority}`}>
                        {row.priority}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="hero-mockup-scan">
                  <div className="hero-mockup-scan-stage" aria-hidden>
                    <div className="hero-mockup-scan-beam" />
                    <ul className="hero-mockup-scan-docs">
                      {Array.from({ length: SCAN_DOC_COUNT }, (_, i) => (
                        <li key={i} className="hero-mockup-doc-tile">
                          <FileText size={13} strokeWidth={2} className="hero-mockup-doc-icon" aria-hidden />
                          <span className="hero-mockup-doc-label">.pdf</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="hero-mockup-scan-track" aria-hidden>
                    <div className="hero-mockup-scan-track-fill" />
                  </div>
                  <p className="hero-mockup-status">
                    <span className="hero-mockup-status-dot" aria-hidden />
                    Scanning {SCAN_DOC_COUNT} regulatory documents…
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="hero-capabilities" id="capabilities" aria-labelledby="capabilities-heading">
            <div className="hero-capabilities-head">
              <p className="hero-section-eyebrow">Capabilities</p>
              <h2 id="capabilities-heading" className="hero-section-h2">
                From PDF to pull request, automatically.
              </h2>
            </div>
            <ul className="hero-cap-grid">
              <li className="hero-cap-card">
                <span className="hero-cap-icon-wrap">
                  <FileText size={22} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="hero-cap-title">PDF intelligence</h3>
                <p className="hero-cap-text">
                  Ingest long-form regulations and extract obligations with citations your auditors can follow.
                </p>
              </li>
              <li className="hero-cap-card">
                <span className="hero-cap-icon-wrap">
                  <GitBranch size={22} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="hero-cap-title">Jira &amp; GitHub sync</h3>
                <p className="hero-cap-text">
                  Push structured work items into the tools your teams already use — with consistent titles and context.
                </p>
              </li>
              <li className="hero-cap-card">
                <span className="hero-cap-icon-wrap">
                  <Shield size={22} strokeWidth={2} aria-hidden />
                </span>
                <h3 className="hero-cap-title">Repo scanning</h3>
                <p className="hero-cap-text">
                  Connect GitHub, select repositories, and surface control gaps with evidence tied to real files and
                  commits.
                </p>
              </li>
            </ul>
          </section>

          <section className="hero-how" id="how-it-works" aria-labelledby="how-heading">
            <h2 id="how-heading" className="hero-how-heading">
              How it works
            </h2>
            <ol className="hero-how-steps">
              <li>
                <strong>Upload &amp; scope</strong>
                <span>Bring your PDFs and frameworks; define what “done” looks like.</span>
              </li>
              <li>
                <strong>Extract &amp; map</strong>
                <span>RegTranslate turns dense text into tasks with criteria and traceability.</span>
              </li>
              <li>
                <strong>Ship &amp; scan</strong>
                <span>Export to Jira or GitHub, then keep code aligned with automated repo checks.</span>
              </li>
            </ol>
            <p className="hero-how-foot">
              <Github size={14} strokeWidth={2} aria-hidden />
              Full scans use GitHub sign-in with{' '}
              <Link to="/scanner" className="hero-inline-muted-link">
                Compliance Scanner
              </Link>
              .
            </p>
          </section>

          <section className="hero-pricing" id="pricing" aria-labelledby="pricing-heading">
            <h2 id="pricing-heading" className="hero-pricing-heading">
              Pricing
            </h2>
            <p className="hero-pricing-lead">
              Start with the interactive demo, then talk to us for team deployment and security review.
            </p>
            <div className="hero-pricing-actions">
              <Link to="/dashboard?demo=1" className="hero-cta-marketing hero-cta-marketing--primary">
                Start free
                <ArrowRight size={18} strokeWidth={2} aria-hidden />
              </Link>
              <a href="mailto:hello@regtranslate.com" className="hero-cta-marketing hero-cta-marketing--outline">
                Contact sales
              </a>
            </div>
          </section>

          <section className="hero-faq" id="faq" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="hero-faq-heading">
              Frequently asked questions
            </h2>
            <div className="hero-faq-list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="hero-faq-item">
                  <summary className="hero-faq-summary">
                    {item.q}
                    <ChevronDown size={18} strokeWidth={2} className="hero-faq-chevron" aria-hidden />
                  </summary>
                  <p className="hero-faq-answer">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
