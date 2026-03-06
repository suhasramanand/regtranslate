import { Routes, Route } from 'react-router-dom'
import { HeroPage } from './HeroPage'
import { Dashboard } from './Dashboard'
import { FlowDemoPage } from './FlowDemoPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/demo-flow" element={<FlowDemoPage />} />
    </Routes>
  )
}

export default App
