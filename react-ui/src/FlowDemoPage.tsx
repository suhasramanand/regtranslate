import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Upload,
  FileSearch,
  Database,
  Search,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  GitBranch,
  List,
} from 'lucide-react'
import { getFlowStages, type FlowStage } from './api'
import './FlowDemoPage.css'

type TabView = 'timeline' | 'graph'

const STAGE_ICONS: Record<string, React.ReactNode> = {
  upload: <Upload size={20} />,
  extract: <FileSearch size={20} />,
  embed: <Database size={20} />,
  store: <Database size={20} />,
  rag: <Search size={20} />,
  llm: <Sparkles size={20} />,
  results: <CheckCircle2 size={20} />,
}

const MAIN_R = 32
const CHILD_R = 10
const MAIN_GAP_X = 130
const CHILD_OFFSET_Y = 70
const CHILD_GAP_Y = 28

function bezierCurve(
  x1: number, y1: number,
  x2: number, y2: number,
  curvature = 0.4
): string {
  const dx = x2 - x1
  const cpx1 = x1 + dx * curvature
  const cpx2 = x2 - dx * curvature
  return `M ${x1} ${y1} C ${cpx1} ${y1}, ${cpx2} ${y2}, ${x2} ${y2}`
}

function branchCurve(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

function FlowGraphView({
  stages,
  currentIndex,
  onNodeClick,
}: {
  stages: FlowStage[]
  currentIndex: number
  onNodeClick: (i: number) => void
}) {
  if (stages.length === 0) return null

  const mainPositions: Array<{ x: number; y: number }> = []
  const childPositions: Array<Array<{ x: number; y: number }>> = []
  const baseY = 100

  stages.forEach((stage, i) => {
    const x = 80 + i * MAIN_GAP_X
    mainPositions.push({ x, y: baseY })
    const details = stage.details ?? []
    const childPos: Array<{ x: number; y: number }> = []
    const startX = x - ((details.length - 1) * CHILD_GAP_Y) / 2
    details.forEach((_, j) => {
      childPos.push({
        x: startX + j * CHILD_GAP_Y,
        y: baseY + CHILD_OFFSET_Y,
      })
    })
    childPositions.push(childPos)
  })

  const width = 80 + (stages.length - 1) * MAIN_GAP_X + 120
  const height = 320

  return (
    <div className="flow-graph-wrap">
      <svg
        className="flow-graph-svg flow-graph-tree"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--border)" />
          </marker>
          <marker id="arrowhead-done" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--accent)" />
          </marker>
          <linearGradient id="node-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
          </linearGradient>
          <filter id="node-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Child branches - curved paths from main to substeps */}
        {stages.map((stage, i) => {
          const main = mainPositions[i]
          const children = childPositions[i]
          const isPast = i < currentIndex
          return children.map((child, j) => {
            const path = branchCurve(
              main.x,
              main.y + MAIN_R,
              child.x,
              child.y - CHILD_R
            )
            return (
              <path
                key={`${i}-${j}`}
                d={path}
                fill="none"
                stroke={isPast ? 'rgba(13, 148, 136, 0.4)' : 'var(--border)'}
                strokeWidth={isPast ? 1.5 : 1}
                strokeDasharray={isPast ? 'none' : '3 3'}
                opacity={i === currentIndex ? 1 : 0.6}
              />
            )
          })
        })}

        {/* Main pipeline - curved Bézier paths */}
        {stages.slice(0, -1).map((_, i) => {
          const from = mainPositions[i]
          const to = mainPositions[i + 1]
          const past = i < currentIndex
          const path = bezierCurve(
            from.x + MAIN_R,
            from.y,
            to.x - MAIN_R,
            to.y,
            0.3
          )
          return (
            <path
              key={i}
              d={path}
              fill="none"
              stroke={past ? 'var(--accent)' : 'var(--border)'}
              strokeWidth={past ? 2.5 : 1.5}
              strokeDasharray={past ? 'none' : '6 4'}
              markerEnd={past ? 'url(#arrowhead-done)' : 'url(#arrowhead)'}
            />
          )
        })}

        {/* Child nodes (substeps) */}
        {stages.map((stage, i) =>
          (stage.details ?? []).map((detail, j) => {
            const pos = childPositions[i][j]
            const isActive = i === currentIndex
            const isPast = i < currentIndex
            return (
              <g
                key={`child-${i}-${j}`}
                className={`flow-graph-child ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                transform={`translate(${pos.x}, ${pos.y})`}
              >
                <circle
                  r={CHILD_R}
                  fill={isPast ? 'var(--accent)' : 'var(--bg-elevated)'}
                  stroke={isActive ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={isActive ? 2 : 1}
                />
                <text
                  x={CHILD_R + 8}
                  y={4}
                  className="flow-graph-child-label"
                >
                  {detail.length > 35 ? detail.slice(0, 34) + '…' : detail}
                </text>
              </g>
            )
          })
        )}

        {/* Main stage nodes */}
        {stages.map((stage, i) => {
          const pos = mainPositions[i]
          const isActive = i === currentIndex
          const isPast = i < currentIndex

          return (
            <g
              key={stage.id}
              className={`flow-graph-node ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => onNodeClick(i)}
            >
              <circle
                r={MAIN_R}
                fill={isActive ? 'url(#node-grad)' : 'var(--bg-secondary)'}
                stroke={isActive ? 'var(--accent)' : 'var(--border)'}
                strokeWidth={isActive ? 3 : 1.5}
                filter={isActive ? 'url(#node-shadow)' : undefined}
              />
              <foreignObject x={-18} y={-10} width={36} height={20}>
                <div className="flow-graph-icon-wrap">
                  {STAGE_ICONS[stage.id] ?? <FileText size={18} />}
                </div>
              </foreignObject>
              <text
                y={MAIN_R + 18}
                textAnchor="middle"
                className="flow-graph-label"
              >
                {stage.title}
              </text>
              {isPast && (
                <circle
                  r={8}
                  cx={MAIN_R - 4}
                  cy={-MAIN_R + 4}
                  fill="var(--accent)"
                />
              )}
              {isPast && (
                <text x={MAIN_R - 4} y={-MAIN_R + 8} textAnchor="middle" fill="white" fontSize="10">
                  ✓
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="flow-graph-details">
        {stages[currentIndex] && (
          <div className="flow-graph-detail-card">
            <h4>{stages[currentIndex].title}</h4>
            <p>{stages[currentIndex].desc}</p>
            {(stages[currentIndex].details ?? []).length > 0 && (
              <ul>
                {stages[currentIndex].details!.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function FlowDemoPage() {
  const [stages, setStages] = useState<FlowStage[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [tab, setTab] = useState<TabView>('timeline')
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getFlowStages()
      .then(({ stages: s }) => setStages(s))
      .catch(() => setStages([]))
      .finally(() => setLoading(false))
  }, [])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < stages.length - 1 ? i + 1 : 0))
  }, [stages.length])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : stages.length - 1))
  }, [stages.length])

  const reset = useCallback(() => {
    setCurrentIndex(0)
    setPlaying(true)
  }, [])

  const toggleExpand = useCallback((i: number) => {
    setExpanded((e) => (e === i ? null : i))
  }, [])

  useEffect(() => {
    if (!playing || stages.length === 0) return
    const stage = stages[currentIndex]
    const duration = stage?.duration_ms ?? 3000
    const t = setTimeout(goNext, duration)
    return () => clearTimeout(t)
  }, [playing, currentIndex, stages, goNext])

  useEffect(() => {
    setExpanded(currentIndex)
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentIndex])

  if (loading) {
    return (
      <div className="flow-demo">
        <div className="flow-demo-loading">Loading flow...</div>
      </div>
    )
  }

  return (
    <div className="flow-demo">
      <header className="flow-demo-header">
        <Link to="/" className="flow-demo-brand">
          <FileText size={24} strokeWidth={2} />
          RegTranslate
        </Link>
        <h1 className="flow-demo-title">Pipeline</h1>
        <p className="flow-demo-subtitle">
          Document upload → extraction → embedding → storage → RAG → LLM → tasks
        </p>

        <div className="flow-tabs">
          <button
            type="button"
            className={`flow-tab ${tab === 'timeline' ? 'active' : ''}`}
            onClick={() => setTab('timeline')}
          >
            <List size={18} />
            Timeline
          </button>
          <button
            type="button"
            className={`flow-tab ${tab === 'graph' ? 'active' : ''}`}
            onClick={() => setTab('graph')}
          >
            <GitBranch size={18} />
            Graph
          </button>
        </div>
      </header>

      {tab === 'timeline' && (
      <div className="flow-timeline">
        {stages.map((stage, i) => {
          const isActive = i === currentIndex
          const isPast = i < currentIndex
          const isExpanded = expanded === i
          const details = stage.details ?? []

          return (
            <div
              key={stage.id}
              ref={isActive ? activeRef : undefined}
              className={`flow-node ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
            >
              <div className="flow-node-connector">
                <div className="flow-node-dot">
                  {isPast ? (
                    <CheckCircle2 size={18} className="flow-dot-success" />
                  ) : isActive ? (
                    <Loader2 size={18} className="flow-dot-spinner" />
                  ) : (
                    <Circle size={14} className="flow-dot-pending" />
                  )}
                </div>
                {i < stages.length - 1 && <div className="flow-node-line" />}
              </div>

              <div className="flow-node-content">
                <button
                  type="button"
                  className={`flow-node-header ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleExpand(i)}
                >
                  <span className="flow-node-icon">{STAGE_ICONS[stage.id] ?? <FileText size={20} />}</span>
                  <span className="flow-node-title">{stage.title}</span>
                  <span className="flow-node-chevron">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                </button>
                <div className={`flow-node-body ${isExpanded ? 'open' : ''}`}>
                  <p className="flow-node-desc">{stage.desc}</p>
                  {details.length > 0 && (
                    <ul className="flow-node-details">
                      {details.map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {tab === 'graph' && (
        <FlowGraphView
          stages={stages}
          currentIndex={currentIndex}
          onNodeClick={(i) => setCurrentIndex(i)}
        />
      )}

      <div className="flow-demo-progress">
        <div
          className="flow-progress-bar"
          style={{ width: `${((currentIndex + 1) / stages.length) * 100}%` }}
        />
        <span className="flow-progress-text">
          Step {currentIndex + 1} of {stages.length}
        </span>
      </div>

      <div className="flow-demo-actions">
        <button
          type="button"
          className="flow-btn flow-btn-secondary"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? 'Pause' : <><Play size={18} /> Play</>}
        </button>
        <button type="button" className="flow-btn flow-btn-secondary" onClick={goPrev}>
          ← Previous
        </button>
        <button type="button" className="flow-btn flow-btn-secondary" onClick={goNext}>
          Next →
        </button>
        <button type="button" className="flow-btn flow-btn-primary" onClick={reset}>
          <RotateCcw size={18} />
          Restart
        </button>
        <Link to="/dashboard?demo=1" className="flow-btn flow-btn-cta">
          Try in Dashboard
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  )
}
