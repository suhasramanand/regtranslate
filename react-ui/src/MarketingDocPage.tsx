import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MarketingSubpageLayout } from './MarketingSubpageLayout'

const PAGES: Record<string, { title: string; body: ReactNode }> = {
  about: {
    title: 'About',
    body: (
      <>
        <p>
          RegTranslate helps regulated teams turn dense policy PDFs into structured work in Jira and GitHub — and keep
          code aligned with Compliance Scanner.
        </p>
        <p>
          We focus on traceability: every task ties back to source language, and repo scans cite real paths and commits.
        </p>
        <p>
          <a href="mailto:hello@regtranslate.com">Get in touch</a> for product questions or partnerships.
        </p>
      </>
    ),
  },
  blog: {
    title: 'Blog',
    body: (
      <>
        <p>Product updates, compliance workflow ideas, and release notes will appear here.</p>
        <p>
          For now, see the <Link to="/changelog">Changelog</Link> or start the{' '}
          <Link to="/dashboard?demo=1">interactive demo</Link>.
        </p>
      </>
    ),
  },
  careers: {
    title: 'Careers',
    body: (
      <>
        <p>We’re not hiring for public roles at the moment. We still love hearing from strong builders.</p>
        <p>
          Send a note to <a href="mailto:careers@regtranslate.com">careers@regtranslate.com</a> with what you’d like to
          work on.
        </p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    body: (
      <>
        <p>
          <strong>General &amp; sales:</strong>{' '}
          <a href="mailto:hello@regtranslate.com">hello@regtranslate.com</a>
        </p>
        <p>
          <strong>Security:</strong> see our <Link to="/security">Security</Link> page for an overview; detailed
          questionnaires on request.
        </p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy',
    body: (
      <>
        <p>
          This page describes how RegTranslate handles information in typical deployments. Your organization’s own
          policies and data-processing agreements may also apply.
        </p>
        <p>
          <strong>Data you upload</strong> (for example PDFs and configuration) is processed to deliver the product.
          Deployment-specific storage and retention are controlled by your environment.
        </p>
        <p>
          <strong>Contact:</strong> <a href="mailto:hello@regtranslate.com">hello@regtranslate.com</a> for privacy
          requests.
        </p>
      </>
    ),
  },
  terms: {
    title: 'Terms of service',
    body: (
      <>
        <p>
          RegTranslate is provided as-is for your internal compliance and engineering workflows. Exact terms for your
          organization should be set in your order form or enterprise agreement.
        </p>
        <p>
          For a formal contract or evaluation terms, contact{' '}
          <a href="mailto:hello@regtranslate.com">hello@regtranslate.com</a>.
        </p>
      </>
    ),
  },
  security: {
    title: 'Security',
    body: (
      <>
        <p>
          RegTranslate is designed to run in environments you control. Use your identity provider, network policies,
          and hosting boundaries to meet your security requirements.
        </p>
        <ul className="mkt-sub-list">
          <li>Scanner GitHub credentials can be stored encrypted in your scanner deployment.</li>
          <li>Vector and audit data paths are configurable via environment variables.</li>
          <li>For a security review packet, email <a href="mailto:hello@regtranslate.com">hello@regtranslate.com</a>.</li>
        </ul>
      </>
    ),
  },
  status: {
    title: 'Status',
    body: (
      <>
        <p>
          <strong>All systems operational</strong> for the hosted demo and documentation. If you self-host, status
          reflects your own infrastructure.
        </p>
        <p>
          Report incidents to <a href="mailto:hello@regtranslate.com">hello@regtranslate.com</a>.
        </p>
      </>
    ),
  },
  changelog: {
    title: 'Changelog',
    body: (
      <>
        <p>High-level product history. For source changes, follow your repository commits.</p>
        <ul className="mkt-sub-list">
          <li>
            <strong>2026</strong> — Marketing site refresh, Compliance Scanner landing, expanded auth flows.
          </li>
          <li>
            <strong>Earlier</strong> — Dashboard demo, Jira/GitHub export, PDF extraction pipeline.
          </li>
        </ul>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </>
    ),
  },
}

export type MarketingDocKey = keyof typeof PAGES

export function MarketingDocPage({ page }: { page: MarketingDocKey }) {
  const meta = PAGES[page]
  return <MarketingSubpageLayout title={meta.title}>{meta.body}</MarketingSubpageLayout>
}
