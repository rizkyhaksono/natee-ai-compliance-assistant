const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface Document {
  id: string;
  name: string;
  document_type: string;
  status: string;
  version?: string;
  division?: string;
  total_chunks: number;
  created_at: string;
  original_filename?: string;
  file_size?: number;
  description?: string;
}

export interface SourceChunk {
  chunk_id: string;
  document_id: string;
  document_name: string;
  document_type: string;
  section?: string;
  page_number?: number;
  content: string;
  relevance_score: number;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  confidence: number;
  guardrail_flags: string[];
  audit_log_id: string;
}

export interface GapItem {
  regulation_clause: string;
  regulation_text: string;
  internal_reference?: string;
  internal_text?: string;
  status: string;
  risk_level: string;
  gap_description: string;
  recommended_action: string;
}

export interface GapAnalysisResponse {
  regulation_document: string;
  internal_document: string;
  total_items: number;
  compliant_count: number;
  partial_count: number;
  non_compliant_count: number;
  not_found_count: number;
  overall_risk: string;
  gaps: GapItem[];
  summary: string;
  audit_log_id: string;
}

export interface ChecklistItem {
  item_number: number;
  requirement: string;
  source_clause: string;
  priority: string;
  action_needed: string;
  responsible_party?: string;
  deadline_suggestion?: string;
  notes?: string;
}

export interface ChecklistResponse {
  document_name: string;
  total_items: number;
  items: ChecklistItem[];
  summary: string;
  audit_log_id: string;
}

export interface AuditLog {
  id: string;
  action: string;
  query?: string;
  response?: string;
  confidence_score?: number;
  judgment_mode?: string;
  guardrail_flags?: string[];
  reviewer_feedback?: string;
  reviewer_score?: number;
  created_at: string;
}

export interface EvaluationSummary {
  total_evaluations: number;
  avg_retrieval_relevance?: number;
  avg_faithfulness?: number;
  avg_groundedness?: number;
  avg_citation_correctness?: number;
  results: any[];
}

// API functions
export async function uploadDocument(file: File, metadata: Record<string, string>): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(metadata).forEach(([key, value]) => {
    if (value) formData.append(key, value);
  });
  const res = await fetch(`${API_BASE}/api/documents/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDocuments(type?: string): Promise<Document[]> {
  const url = type ? `${API_BASE}/api/documents/?document_type=${type}` : `${API_BASE}/api/documents/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function sendChat(query: string, documentIds?: string[], judgmentMode?: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, document_ids: documentIds, judgment_mode: judgmentMode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function runGapAnalysis(regulationDocId: string, internalDocId: string, judgmentMode?: string): Promise<GapAnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/gap-analysis/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      regulation_document_id: regulationDocId,
      internal_document_id: internalDocId,
      judgment_mode: judgmentMode,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateChecklist(documentId: string, focusArea?: string, judgmentMode?: string): Promise<ChecklistResponse> {
  const res = await fetch(`${API_BASE}/api/checklist/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId, focus_area: focusArea, judgment_mode: judgmentMode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAuditLogs(action?: string): Promise<AuditLog[]> {
  const url = action ? `${API_BASE}/api/audit/?action=${action}` : `${API_BASE}/api/audit/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getEvaluationSummary(): Promise<EvaluationSummary> {
  const res = await fetch(`${API_BASE}/api/evaluation/summary`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function runEvaluation(testQueries?: string[]): Promise<EvaluationSummary> {
  const res = await fetch(`${API_BASE}/api/evaluation/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_queries: testQueries }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
