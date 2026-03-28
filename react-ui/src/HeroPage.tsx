import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FileText,
  ArrowRight,
  Github,
  GitBranch,
  Shield,
  ChevronDown,
} from 'lucide-react'
import { MarketingFooter } from './MarketingFooter'
import { SiteHeader } from './SiteHeader'
import './HeroPage.css'

const FAQ_ITEMS = [
  {
    q: 'How does PDF automation work?',
    a: 'We turn long regulatory PDFs into clear, structured tasks—no manual copy-paste. You review what matters, then send it to your team’s tools in a few clicks.',
  },
  {
    q: 'Can I connect Jira or GitHub?',
    a: 'Yes. Push requirements and findings into Jira or GitHub issues so compliance work lives alongside everything else your team already tracks.',
  },
  {
    q: 'Does it scan code repositories?',
    a: 'Yes. Connect your repos to spot gaps against your obligations and see concrete places to fix—not vague “check the policy” reminders.',
  },
  {
    q: 'Who is RegTranslate for?',
    a: 'Compliance leads, product owners, and engineers at regulated companies who want calmer audits, less busywork, and one place to connect documents, code, and tickets.',
  },
]

const MOCK_FINDINGS = [
  { id: 'SOX-404', title: 'Internal control gap', priority: 'high' as const },
  { id: 'GDPR-17', title: 'Erasure workflow', priority: 'medium' as const },
  { id: 'HIPAA-164', title: 'Access review cadence', priority: 'medium' as const },
  { id: 'WCAG-2.1', title: 'Form error association', priority: 'low' as const },
]

const SCAN_DOC_COUNT = 12

const PLATFORM_MEGA = [
  {
    label: 'Compliance tools',
    items: [
      {
        title: 'PDF extraction',
        desc: 'Convert regulatory PDFs into actionable tasks.',
        to: '/#capabilities',
      },
      {
        title: 'Jira integration',
        desc: 'Sync compliance work directly to Jira.',
        to: '/#how-it-works',
      },
      {
        title: 'GitHub sync',
        desc: 'Push findings to GitHub issues.',
        to: '/#how-it-works',
      },
    ],
  },
  {
    label: 'Automation',
    items: [
      {
        title: 'Repo scanning',
        desc: 'Scan codebases for compliance risks.',
        to: '/scanner',
      },
      {
        title: 'AI summaries',
        desc: 'Get instant, clear compliance insights.',
        to: '/#capabilities',
      },
      {
        title: 'Audit trails',
        desc: 'Track every change for full traceability.',
        to: '/signup',
      },
    ],
  },
  {
    label: 'Resources',
    items: [
      {
        title: 'Documentation',
        desc: 'Step-by-step guides for every feature.',
        to: '/#faq',
      },
      {
        title: 'API reference',
        desc: 'Integrate with your existing stack.',
        to: '/changelog',
      },
      {
        title: 'Security',
        desc: 'Enterprise-grade data protection.',
        to: '/security',
      },
    ],
  },
] as const

const HELP_LINKS = [
  { title: 'Documentation', desc: 'Guides and FAQs.', to: '/#faq' },
  { title: 'Contact', desc: 'Talk to the team.', to: '/contact' },
  { title: 'Status', desc: 'Service health.', to: '/status' },
] as const

export function HeroPage() {
  const location = useLocation()
  const [platformOpen, setPlatformOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const megaRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = location.hash?.replace(/^#/, '')
    if (!id || location.pathname !== '/') return
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.pathname, location.hash])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (megaRef.current?.contains(t) || helpRef.current?.contains(t)) return
      setPlatformOpen(false)
      setHelpOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPlatformOpen(false)
        setHelpOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div className="hero hero--marketing">
      <SiteHeader
        variant="marketing"
        brandCurrent
        marketingCenter={
          <nav className="hero-nav-center" aria-label="Product">
            <div className="hero-nav-dropdown" ref={megaRef}>
              <button
                type="button"
                className="hero-nav-site-link hero-nav-site-link--trigger"
                aria-expanded={platformOpen}
                aria-haspopup="true"
                aria-controls="hero-platform-mega"
                id="hero-platform-trigger"
                onClick={() => {
                  setHelpOpen(false)
                  setPlatformOpen((o) => !o)
                }}
              >
                Platform
                <ChevronDown size={16} strokeWidth={2} className="hero-nav-chevron" aria-hidden />
              </button>
              <div
                id="hero-platform-mega"
                className={`hero-mega-panel${platformOpen ? ' hero-mega-panel--open' : ''}`}
                role="region"
                aria-labelledby="hero-platform-trigger"
                hidden={!platformOpen}
              >
                <div className="hero-mega-grid">
                  {PLATFORM_MEGA.map((col) => (
                    <div key={col.label} className="hero-mega-col">
                      <p className="hero-mega-col-label">{col.label}</p>
                      <ul className="hero-mega-list">
                        {col.items.map((item) => (
                          <li key={item.title}>
                            <Link
                              to={item.to}
                              className="hero-mega-link"
                              onClick={() => setPlatformOpen(false)}
                            >
                              <span className="hero-mega-link-title">{item.title}</span>
                              <span className="hero-mega-link-desc">{item.desc}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Link to="/about" className="hero-nav-site-link">
              Company
            </Link>
            <Link to="/blog" className="hero-nav-site-link">
              Insights
            </Link>
            <Link to="/#pricing" className="hero-nav-site-link">
              Pricing
            </Link>
            <div className="hero-nav-dropdown" ref={helpRef}>
              <button
                type="button"
                className="hero-nav-site-link hero-nav-site-link--trigger"
                aria-expanded={helpOpen}
                aria-haspopup="true"
                aria-controls="hero-help-menu"
                id="hero-help-trigger"
                onClick={() => {
                  setPlatformOpen(false)
                  setHelpOpen((o) => !o)
                }}
              >
                Help
                <ChevronDown size={16} strokeWidth={2} className="hero-nav-chevron" aria-hidden />
              </button>
              <div
                id="hero-help-menu"
                className={`hero-help-panel${helpOpen ? ' hero-help-panel--open' : ''}`}
                aria-labelledby="hero-help-trigger"
                hidden={!helpOpen}
              >
                <ul className="hero-help-list">
                  {HELP_LINKS.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="hero-help-link"
                        onClick={() => setHelpOpen(false)}
                      >
                        <span className="hero-mega-link-title">{item.title}</span>
                        <span className="hero-mega-link-desc">{item.desc}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        }
      />

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
                <Link to="/signup" className="hero-cta-marketing hero-cta-marketing--primary">
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
              <Link to="/signup" className="hero-cta-marketing hero-cta-marketing--primary">
                Start free
                <ArrowRight size={18} strokeWidth={2} aria-hidden />
              </Link>
              <a href="mailto:hello@regtranslate.com" className="hero-cta-marketing hero-cta-marketing--outline">
                Contact sales
              </a>
            </div>
          </section>

          <section className="hero-faq" id="faq" aria-labelledby="faq-heading">
            <header className="hero-faq-head">
              <h2 id="faq-heading" className="hero-faq-heading">
                Compliance clarity, zero guesswork
              </h2>
              <p className="hero-faq-sub">
                Quick answers to your compliance workflow questions.
              </p>
            </header>
            <dl className="hero-faq-grid">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q} className="hero-faq-row">
                  <dt className="hero-faq-q">{item.q}</dt>
                  <dd className="hero-faq-a">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
