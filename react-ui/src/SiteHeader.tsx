import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Github, Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'
import './SiteHeader.css'

export type SiteHeaderVariant = 'marketing' | 'login' | 'signup' | 'scanner' | 'subpage'

export type SiteHeaderProps = {
  variant: SiteHeaderVariant
  /** Marketing home only: center column (mega menus, etc.) */
  marketingCenter?: ReactNode
  oauthConfigured?: boolean
  onGithubClick?: () => void
  /** Home link uses aria-current="page" */
  brandCurrent?: boolean
}

export function SiteHeader({
  variant,
  marketingCenter,
  oauthConfigured = false,
  onGithubClick,
  brandCurrent = false,
}: SiteHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const qs = location.search || ''
  const isMarketing = variant === 'marketing'
  const innerClass = isMarketing ? 'site-header__inner site-header__inner--marketing' : 'site-header__inner site-header__inner--stack'

  /* Auth + scanner landing: center nav already has sign-up/sign-in; hide duplicate Log in / Get Started. */
  const onDedicatedAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const authSurface = variant === 'login' || variant === 'signup' || onDedicatedAuthPage
  const onScannerPage = variant === 'scanner' || location.pathname === '/scanner'
  const compactActionRail = authSurface || onScannerPage

  return (
    <header className={`site-header${compactActionRail ? ' site-header--auth' : ''}`}>
      <div className={innerClass}>
        <div className="site-header__brand-wrap">
          <Link
            to="/"
            className="site-header__brand"
            aria-current={brandCurrent ? 'page' : undefined}
          >
            <span className="site-header__brand-reg">Reg</span>
            <span className="site-header__brand-translate">Translate</span>
          </Link>
          {variant === 'scanner' && (
            <>
              <span className="site-header__divider" aria-hidden />
              <span className="site-header__product">Compliance Scanner</span>
            </>
          )}
        </div>

        <div className="site-header__slot-center">
          {isMarketing && marketingCenter}
          {variant === 'login' && (
            <nav className="site-header__simple-nav" aria-label="Sign in shortcuts">
              <Link to="/" className="site-header__link">
                Home
              </Link>
              <Link to="/scanner" className="site-header__link">
                Compliance
              </Link>
              <Link to={`/signup${qs}`} className="site-header__link site-header__link--accent">
                Sign up
              </Link>
            </nav>
          )}
          {variant === 'signup' && (
            <nav className="site-header__simple-nav" aria-label="Account shortcuts">
              <Link to="/" className="site-header__link">
                Home
              </Link>
              <Link to="/scanner" className="site-header__link">
                Compliance
              </Link>
              <Link to={`/login${qs}`} className="site-header__link site-header__link--accent">
                Sign in
              </Link>
            </nav>
          )}
          {variant === 'scanner' && (
            <nav className="site-header__simple-nav" aria-label="Site">
              <Link to="/" className="site-header__link">
                Home
              </Link>
              <Link to="/dashboard?demo=1" className="site-header__link">
                Demo
              </Link>
              <Link to={`/signup${qs || '?next=/scanner/app'}`} className="site-header__link site-header__link--accent">
                Sign up
              </Link>
              <Link to={`/login${qs || '?next=/scanner/app'}`} className="site-header__link">
                Sign in
              </Link>
            </nav>
          )}
        </div>

        <div className="site-header__actions">
          {variant !== 'subpage' && !onDedicatedAuthPage && !onScannerPage && (
            <>
              <Link
                to="/login"
                className="site-header__login"
                aria-current={location.pathname === '/login' ? 'page' : undefined}
              >
                Log in
              </Link>
              <Link to={`/signup${qs}`} className="site-header__cta" aria-current={location.pathname === '/signup' ? 'page' : undefined}>
                Get Started
              </Link>
            </>
          )}
          {variant === 'subpage' && (
            <>
              <Link to="/login" className="site-header__login">
                Log in
              </Link>
              <Link to="/signup" className="site-header__cta" aria-current={location.pathname === '/signup' ? 'page' : undefined}>
                Get Started
              </Link>
            </>
          )}
          {(variant === 'login' || variant === 'signup') && onGithubClick && (
            <button
              type="button"
              className={`site-header__icon-btn${oauthConfigured ? ' site-header__icon-btn--primary' : ''}`}
              onClick={onGithubClick}
              aria-label="Continue with GitHub in the browser"
              title={
                oauthConfigured
                  ? 'Continue with GitHub in the browser'
                  : 'Use credential sign-in in the form, or enable OAuth on the scanner'
              }
            >
              <Github size={20} strokeWidth={2} aria-hidden />
            </button>
          )}
          <button
            type="button"
            className="site-header__theme"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </header>
  )
}
