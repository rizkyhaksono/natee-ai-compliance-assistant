"use client";

import { useState, useEffect } from "react";
import { getDocuments, generateChecklist, Document, ChecklistResponse } from "@/lib/api";
import { ClipboardCheck, User, Calendar, History, Trash2, ChevronRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

interface ChecklistHistoryItem {
  id: string;
  documentName: string;
  focusArea?: string;
  timestamp: string;
  result: ChecklistResponse;
}

const HISTORY_KEY = "checklist_history";

function loadHistory(): ChecklistHistoryItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

function saveHistory(items: ChecklistHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

function relativeTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// Skeleton loader for checklist items
function ChecklistSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-3 w-72 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" />
        <div className="mt-1 h-3 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" />
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-4 px-6 py-4">
            <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
                  style={{ width: `${55 + i * 7}%` }}
                />
                <div className="h-4 w-14 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800/60" />
              </div>
              <div className="h-3 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" style={{ width: `${70 + i * 4}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChecklistPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [judgmentMode, setJudgmentMode] = useState("moderate");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChecklistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChecklistHistoryItem[]>([]);

  useEffect(() => {
    getDocuments(1, 1000)
      .then((res) => setDocuments(res.items.filter((d) => d.status === "ready")))
      .catch(console.error);
    setHistory(loadHistory());
  }, []);

  const readyDocuments = documents;

  const handleGenerate = async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateChecklist(documentId, focusArea || undefined, judgmentMode);
      setResult(res);

      const newItem: ChecklistHistoryItem = {
        id: Math.random().toString(36).slice(2),
        documentName: res.document_name,
        focusArea: focusArea || undefined,
        timestamp: new Date().toISOString(),
        result: res,
      };
      const updated = [newItem, ...history];
      saveHistory(updated);
      setHistory(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal generate checklist");
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryItem = (item: ChecklistHistoryItem) => {
    setResult(item.result);
    setError(null);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
    setHistory(updated);
  };

  const priorityVariant = (priority: string): "danger" | "warning" | "info" | "default" => {
    const map: Record<string, "danger" | "warning" | "info" | "default"> = {
      critical: "danger", high: "warning", medium: "info", low: "default",
    };
    return map[priority] || "default";
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* History Sidebar */}
      {history.length > 0 && (
        <div className="flex w-56 flex-shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <History className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Riwayat Checklist</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadHistoryItem(item)}
                className="group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {item.documentName.replace(".pdf", "")}
                  </p>
                  {item.focusArea && (
                    <p className="truncate text-xs text-zinc-400">{item.focusArea}</p>
                  )}
                  <p className="text-xs text-zinc-400 dark:text-zinc-600">{relativeTime(item.timestamp)}</p>
                </div>
                <button
                  onClick={(e) => deleteHistoryItem(item.id, e)}
                  className="hidden rounded p-0.5 text-zinc-400 hover:text-rose-500 group-hover:block"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-zinc-50 px-6 pt-6 pb-4 dark:bg-zinc-950">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Compliance Checklist Generator
          </h2>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </div>
          )}

          {readyDocuments.length === 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Belum ada dokumen dengan status ready. Upload dan tunggu pemrosesan selesai di halaman Documents.
            </div>
          )}

          {/* Controls */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Document</label>
                <select
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Select document...</option>
                  {readyDocuments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Focus Area (optional)</label>
                <input
                  type="text"
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  placeholder="e.g., vendor management"
                  disabled={loading}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Judgment Mode</label>
                <select
                  value={judgmentMode}
                  onChange={(e) => setJudgmentMode(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="lenient">Lenient</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleGenerate}
                  disabled={loading || readyDocuments.length === 0 || !documentId}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {loading ? "Generating..." : "Generate Checklist"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Results */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading && <ChecklistSkeleton />}

          {result && !loading && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{result.document_name}</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{result.summary}</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{result.total_items} items</p>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {result.items.map((item) => (
                  <div key={item.item_number} className="flex items-start gap-4 px-6 py-4">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {item.item_number}
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.requirement}</span>
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                      </div>
                      <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">Source: {item.source_clause}</p>
                      <p className="text-sm text-zinc-700 dark:text-zinc-200">{item.action_needed}</p>
                      {(item.responsible_party || item.deadline_suggestion) && (
                        <div className="mt-2 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                          {item.responsible_party && (
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{item.responsible_party}</span>
                          )}
                          {item.deadline_suggestion && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{item.deadline_suggestion}</span>
                          )}
                        </div>
                      )}
                      {item.notes && (
                        <p className="mt-1 text-xs italic text-zinc-400 dark:text-zinc-500">{item.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result && !loading && readyDocuments.length > 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="Generate a Compliance Checklist"
              description="Select a document to generate actionable compliance items"
            />
          )}
        </div>
      </div>
    </div>
  );
}
