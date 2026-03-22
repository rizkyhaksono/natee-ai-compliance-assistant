"use client";

import { useState, useEffect, useRef } from "react";
import { getDocuments, runGapAnalysis, Document, GapAnalysisResponse } from "@/lib/api";
import {
  GitCompareArrows,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  History,
  Trash2,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

interface GapHistoryItem {
  id: string;
  regulationDoc: string;
  internalDoc: string;
  timestamp: string;
  result: GapAnalysisResponse;
}

const HISTORY_KEY = "gap_analysis_history";
const ANALYSIS_STEPS = [
  "Membaca dokumen regulasi...",
  "Membaca dokumen internal...",
  "Mencari perbedaan compliance...",
  "Menganalisis kesenjangan...",
  "Menyusun rekomendasi...",
];

function loadHistory(): GapHistoryItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

function saveHistory(items: GapHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

function relativeTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// Step-based loading indicator
function AnalysisLoader({ step }: { step: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-sm space-y-3">
        {ANALYSIS_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  done
                    ? "border-emerald-500 bg-emerald-500"
                    : active
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {done ? (
                  <CheckCircle className="h-3.5 w-3.5 text-white" />
                ) : active ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                ) : null}
              </div>
              <span
                className={`text-sm ${
                  done
                    ? "text-zinc-400 line-through dark:text-zinc-600"
                    : active
                    ? "font-medium text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-600"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GapAnalysisPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [regulationDocId, setRegulationDocId] = useState("");
  const [internalDocId, setInternalDocId] = useState("");
  const [judgmentMode, setJudgmentMode] = useState("moderate");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<GapAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GapHistoryItem[]>([]);
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getDocuments(1, 1000)
      .then((res) => setDocuments(res.items.filter((d) => d.status === "ready")))
      .catch(console.error);
    setHistory(loadHistory());
  }, []);

  const readyDocuments = documents;

  const startStepAnimation = () => {
    setLoadingStep(0);
    stepIntervalRef.current = setInterval(() => {
      setLoadingStep((prev) => (prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev));
    }, 2000);
  };

  const stopStepAnimation = () => {
    if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
  };

  const handleAnalyze = async () => {
    if (!regulationDocId || !internalDocId) return;
    setLoading(true);
    setError(null);
    startStepAnimation();
    try {
      const res = await runGapAnalysis(regulationDocId, internalDocId, judgmentMode);
      setResult(res);

      const regDoc = readyDocuments.find((d) => d.id === regulationDocId);
      const intDoc = readyDocuments.find((d) => d.id === internalDocId);
      const newItem: GapHistoryItem = {
        id: Math.random().toString(36).slice(2),
        regulationDoc: regDoc?.name || regulationDocId,
        internalDoc: intDoc?.name || internalDocId,
        timestamp: new Date().toISOString(),
        result: res,
      };
      const updated = [newItem, ...history];
      saveHistory(updated);
      setHistory(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menjalankan gap analysis");
    } finally {
      stopStepAnimation();
      setLoading(false);
    }
  };

  const loadHistoryItem = (item: GapHistoryItem) => {
    setResult(item.result);
    setError(null);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
    setHistory(updated);
  };

  const statusConfig: Record<string, { icon: LucideIcon; variant: "success" | "warning" | "danger" | "default" }> = {
    compliant: { icon: CheckCircle, variant: "success" },
    partial: { icon: AlertTriangle, variant: "warning" },
    non_compliant: { icon: AlertCircle, variant: "danger" },
    not_found: { icon: HelpCircle, variant: "default" },
  };

  const riskVariant = (risk: string): "danger" | "warning" | "success" | "default" => {
    const map: Record<string, "danger" | "warning" | "success" | "default"> = {
      high: "danger", medium: "warning", low: "success", compliant: "success",
    };
    return map[risk] || "default";
  };

  const statCardBg = (type: string) => {
    const map: Record<string, string> = {
      total: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
      compliant: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
      partial: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
      non_compliant: "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950",
      not_found: "border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900",
    };
    return map[type] || map.total;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* History Sidebar */}
      {history.length > 0 && (
        <div className="flex w-56 flex-shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <History className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Riwayat Analisis</span>
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
                    {item.regulationDoc.replace(".pdf", "")}
                  </p>
                  <p className="truncate text-xs text-zinc-400">vs {item.internalDoc.replace(".pdf", "")}</p>
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
        <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-zinc-50 dark:bg-zinc-950">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Gap Analysis</h2>

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
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Regulation Document</label>
                <select
                  value={regulationDocId}
                  onChange={(e) => setRegulationDocId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Select regulation...</option>
                  {readyDocuments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Internal Document</label>
                <select
                  value={internalDocId}
                  onChange={(e) => setInternalDocId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Select internal doc...</option>
                  {readyDocuments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Judgment Mode</label>
                <select
                  value={judgmentMode}
                  onChange={(e) => setJudgmentMode(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="lenient">Lenient</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAnalyze}
                  disabled={loading || readyDocuments.length === 0 || !regulationDocId || !internalDocId}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
                >
                  <GitCompareArrows className="h-4 w-4" />
                  {loading ? "Analyzing..." : "Run Analysis"}
                </button>
              </div>
            </div>
            {(!regulationDocId || !internalDocId) && readyDocuments.length >= 2 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Select both a regulation document and an internal document to proceed
              </p>
            )}
          </div>
        </div>

        {/* Scrollable Results */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading && <AnalysisLoader step={loadingStep} />}

          {result && !loading && (
            <>
              {/* Stats */}
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {[
                  { label: "Total Items", value: result.total_items, type: "total" },
                  { label: "Compliant", value: result.compliant_count, type: "compliant" },
                  { label: "Partial", value: result.partial_count, type: "partial" },
                  { label: "Non-Compliant", value: result.non_compliant_count, type: "non_compliant" },
                  { label: "Not Found", value: result.not_found_count, type: "not_found" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-4 text-center ${statCardBg(s.type)}`}>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Overall Risk */}
              <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Overall Risk:</span>
                  <Badge variant={riskVariant(result.overall_risk)}>{result.overall_risk.toUpperCase()}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{result.summary}</p>
              </div>

              {/* Gap Items */}
              <div className="space-y-3">
                {result.gaps.map((gap, i) => {
                  const config = statusConfig[gap.status] || statusConfig.not_found;
                  const Icon = config.icon;
                  return (
                    <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Badge variant={config.variant}>
                            <Icon className="mr-1 h-3 w-3" />{gap.status}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{gap.regulation_clause}</span>
                            <Badge variant={riskVariant(gap.risk_level)}>{gap.risk_level}</Badge>
                          </div>
                          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">{gap.gap_description}</p>
                          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                              <span className="font-medium text-zinc-500 dark:text-zinc-400">Regulation:</span>
                              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{gap.regulation_text}</p>
                            </div>
                            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                              <span className="font-medium text-zinc-500 dark:text-zinc-400">Internal:</span>
                              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{gap.internal_text || "Not found"}</p>
                            </div>
                          </div>
                          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                            <span className="font-medium text-zinc-500 dark:text-zinc-400">Recommended Action:</span>
                            <p className="mt-1 text-zinc-700 dark:text-zinc-200">{gap.recommended_action}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!result && !loading && readyDocuments.length > 0 && (
            <EmptyState
              icon={GitCompareArrows}
              title="Run a Gap Analysis"
              description="Select a regulation and an internal document to compare compliance gaps"
            />
          )}
        </div>
      </div>
    </div>
  );
}
