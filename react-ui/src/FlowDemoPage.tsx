import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
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
  upload: <Upload size={18} />,
  extract: <FileSearch size={18} />,
  embed: <Database size={18} />,
  store: <Database size={18} />,
  rag: <Search size={18} />,
  llm: <Sparkles size={18} />,
  results: <CheckCircle2 size={18} />,
}

const NODE_W = 120
const GAP = 96

type PipelineNodeData = {
  stage: FlowStage
  index: number
  isActive: boolean
  isPast: boolean
}

function PipelineNode({ data }: NodeProps<PipelineNodeData>) {
  const { stage, isActive, isPast } = data
  return (
    <>
      <Handle type="target" position={Position.Left} className="flow-rf-handle" />
      <div
        className={`flow-rf-node ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
      >
        <span className="flow-rf-node-icon">
          {STAGE_ICONS[stage.id] ?? <FileText size={18} />}
        </span>
        <span className="flow-rf-node-title">{stage.title}</span>
        {isPast && (
          <span className="flow-rf-node-check">
            <CheckCircle2 size={14} />
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="flow-rf-handle" />
    </>
  )
}

const nodeTypes = { pipeline: PipelineNode }

function FlowGraphView({
  stages,
  currentIndex,
  onNodeClick,
}: {
  stages: FlowStage[]
  currentIndex: number
  onNodeClick: (i: number) => void
}) {
  const nodes: Node<PipelineNodeData>[] = useMemo(
    () =>
      stages.map((stage, i) => ({
        id: stage.id,
        type: 'pipeline',
        position: { x: 40 + i * (NODE_W + GAP), y: 60 },
        data: {
          stage,
          index: i,
          isActive: i === currentIndex,
          isPast: i < currentIndex,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })),
    [stages, currentIndex]
  )

  const edges: Edge[] = useMemo(
    () =>
      stages.slice(0, -1).map((_, i) => ({
        id: `e-${stages[i].id}-${stages[i + 1].id}`,
        source: stages[i].id,
        target: stages[i + 1].id,
        type: 'smoothstep',
        className: i < currentIndex ? 'edge-done' : 'edge-pending',
      })),
    [stages, currentIndex]
  )

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<PipelineNodeData>) => {
      onNodeClick(node.data.index)
    },
    [onNodeClick]
  )

  if (stages.length === 0) return null

  return (
    <div className="flow-graph-wrap">
      <div className="flow-rf-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Background color="var(--border)" gap={16} size={0.5} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

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
    queueMicrotask(() => setExpanded(currentIndex))
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
