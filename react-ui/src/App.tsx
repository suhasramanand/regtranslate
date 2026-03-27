import { Routes, Route, Navigate } from 'react-router-dom'
import { HeroPage } from './HeroPage'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'
import { DashboardRoute } from './DashboardRoute'
import { ScannerLandingPage } from './ScannerLandingPage'
import { ScannerPage } from './ScannerPage'
import { RequireAuth } from './RequireAuth'
import { MarketingDocPage } from './MarketingDocPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/dashboard" element={<DashboardRoute />} />
      <Route path="/scanner" element={<ScannerLandingPage />} />
      <Route path="/about" element={<MarketingDocPage page="about" />} />
      <Route path="/blog" element={<MarketingDocPage page="blog" />} />
      <Route path="/careers" element={<MarketingDocPage page="careers" />} />
      <Route path="/contact" element={<MarketingDocPage page="contact" />} />
      <Route path="/privacy" element={<MarketingDocPage page="privacy" />} />
      <Route path="/terms" element={<MarketingDocPage page="terms" />} />
      <Route path="/security" element={<MarketingDocPage page="security" />} />
      <Route path="/status" element={<MarketingDocPage page="status" />} />
      <Route path="/changelog" element={<MarketingDocPage page="changelog" />} />
      <Route element={<RequireAuth />}>
        <Route path="/scanner/app" element={<ScannerPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
