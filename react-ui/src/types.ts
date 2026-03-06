export interface ExtractionSubtask {
  title: string
  description: string
}

export interface EvidenceLink {
  url: string
  label?: string
}

export interface ExtractionTask {
  task_id: string
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low'
  penalty_risk: string
  source_citation: string
  source_text: string
  responsible_role: string
  acceptance_criteria: string[]
  also_satisfies: string[]
  confidence?: number | null
  subtasks: ExtractionSubtask[]
  evidence_links?: EvidenceLink[]
}

export interface ProcessResponse {
  doc_id: string
  chunk_count: number
  regulation_name: string
  sample_query: string
  sample_results: Array<{ text: string; metadata: Record<string, unknown> }>
}

export interface ExtractResponse {
  tasks: ExtractionTask[]
  coverage?: {
    chunk_count: number
    pages_summary: string
    sections: string[]
    section_4_in_chunks: boolean
  } | null
}
