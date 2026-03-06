import { Link } from 'react-router-dom'
import { FileText, ArrowRight, Shield, FileCode, Zap, HelpCircle, Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'
import './HeroPage.css'

const FAQ_ITEMS = [
  {
    q: 'Do any existing tools do this?',
    a: 'Some tools cover parts of the workflow: Compliance.ai monitors regulatory changes and can push to GRC systems; DigiParser extracts data from documents and can create Jira issues via Zapier; Chunkr structures PDFs into schemas. None offer the full pipeline — regulation-aware extraction (HIPAA, GDPR, FDA, ADA) into developer-ready tasks with acceptance criteria and subtasks, plus direct Jira/GitHub export. RegTranslate combines RAG + LLM extraction, deduplication across regulations, and one-click export in a single flow.',
  },
  {
    q: 'What regulations are supported?',
    a: 'HIPAA, GDPR, ADA/WCAG, FDA 21 CFR Part 11, and Custom. You can upload any regulatory PDF and select the framework for better extraction prompts.',
  },
  {
    q: 'Where does my data go?',
    a: 'PDFs are processed locally (embeddings via sentence-transformers, ChromaDB). The LLM (Groq/Llama or optional Gemini) is used only for task extraction. Your documents stay on your server; only extracted text chunks are sent to the LLM provider for analysis.',
  },
]

export function HeroPage() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="hero">
      <header className="hero-header">
        <div className="hero-brand">
          <FileText size={28} strokeWidth={2} aria-hidden />
          <span>RegTranslate</span>
        </div>
        <button
          type="button"
          className="hero-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="hero-main">
        <h1 className="hero-title">
          Turn regulatory documents into
          <span className="hero-title-accent"> developer-ready tasks</span>
        </h1>
        <p className="hero-subtitle">
          HIPAA, GDPR, FDA 21 CFR Part 11, ADA/WCAG — compliance PDFs are dense and hard to parse.
          Teams waste weeks manually translating requirements into actionable tickets.
        </p>

        <div className="hero-problem">
          <h2 className="hero-problem-title">The problem we solve</h2>
          <ul className="hero-problem-list">
            <li>
              <Shield size={20} aria-hidden />
              <span>Regulatory documents are hundreds of pages of legalese — hard to read, harder to act on</span>
            </li>
            <li>
              <FileCode size={20} aria-hidden />
              <span>Engineers need clear tasks with acceptance criteria, not raw PDF sections</span>
            </li>
            <li>
              <Zap size={20} aria-hidden />
              <span>Manual extraction is slow, error-prone, and doesn&apos;t scale across frameworks</span>
            </li>
          </ul>
        </div>

        <p className="hero-solution">
          RegTranslate uses AI to extract compliance tasks from your PDFs, deduplicate across regulations,
          and export directly to Jira or GitHub — so your team can ship compliant software faster.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'center' }}>
          <Link to="/dashboard" className="hero-cta">
            Get started
            <ArrowRight size={20} aria-hidden />
          </Link>
          <Link to="/demo-flow" className="hero-cta hero-cta-secondary">
            See pipeline flow
          </Link>
        </div>

        <section className="hero-faq" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="hero-faq-title">
            <HelpCircle size={20} aria-hidden />
            FAQ
          </h2>
          <dl className="hero-faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="hero-faq-item">
                <dt className="hero-faq-q">{item.q}</dt>
                <dd className="hero-faq-a">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="hero-footer">
        <span>Regulatory PDF → Developer tasks → Jira / GitHub</span>
      </footer>
    </div>
  )
}
