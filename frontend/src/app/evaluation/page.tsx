"use client";

import { useState, useEffect } from "react";
import { getEvaluationSummary, runEvaluation, EvaluationSummary } from "@/lib/api";
import { Activity, Play } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";

export default function EvaluationPage() {
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadSummary = async (p = page) => {
    try {
      const data = await getEvaluationSummary(p);
      setSummary(data);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat ringkasan evaluasi";
      setError(message);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadSummary(page);
  }, [page]);

  const handleRunEval = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      await runEvaluation();
      setStatus("Evaluation berjalan di background...");

      // Poll until results appear (backend cleared before starting)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const data = await getEvaluationSummary(1);
          if (data.total_evaluations > 0 || attempts > 40) {
            clearInterval(poll);
            setSummary(data);
            setPage(1);
            setStatus("Evaluation selesai. Data terbaru sudah dimuat.");
            setLoading(false);
          }
        } catch {
          clearInterval(poll);
          setLoading(false);
        }
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menjalankan evaluasi";
      setError(message);
      setLoading(false);
    }
  };

  const scoreVariant = (s: number | undefined | null): "success" | "warning" | "danger" | "default" => {
    if (s == null) return "default";
    if (s >= 0.8) return "success";
    if (s >= 0.6) return "warning";
    return "danger";
  };

  const scoreBg = (s: number | undefined | null) => {
    if (s == null) return "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900";
    if (s >= 0.8) return "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950";
    if (s >= 0.6) return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950";
    return "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950";
  };

  const scoreColor = (s: number | undefined | null) => {
    if (s == null) return "text-zinc-400 dark:text-zinc-500";
    if (s >= 0.8) return "text-emerald-700 dark:text-emerald-300";
    if (s >= 0.6) return "text-amber-700 dark:text-amber-300";
    return "text-rose-700 dark:text-rose-300";
  };

  const evalTypeBadge = (type: string) => {
    const variants: Record<string, "info" | "warning" | "success" | "default"> = {
      retrieval_relevance: "info",
      faithfulness: "success",
      groundedness: "warning",
      citation_correctness: "default",
    };
    return <Badge variant={variants[type] || "default"}>{type.replace(/_/g, " ")}</Badge>;
  };

  const results = summary?.results;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between bg-zinc-50 px-6 py-4 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Evaluation Dashboard
        </h2>
        <button
          onClick={handleRunEval}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          <Play className="h-4 w-4" />
          {loading ? "Running..." : "Run Evaluation"}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}
      {status && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {status}
        </div>
      )}

      {initialLoading ? (
        <div className="flex justify-center rounded-xl border border-zinc-200 bg-white p-12 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-100" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Memuat ringkasan evaluasi...</span>
          </div>
        </div>
      ) : !summary ? (
        <EmptyState icon={Activity} title="No evaluations yet" description='Click "Run Evaluation" to start evaluating your RAG pipeline' />
      ) : (
        <>
          {/* Metric Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Retrieval Relevance", value: summary.avg_retrieval_relevance },
              { label: "Faithfulness", value: summary.avg_faithfulness },
              { label: "Groundedness", value: summary.avg_groundedness },
              { label: "Citation Correctness", value: summary.avg_citation_correctness },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl border p-4 ${scoreBg(m.value)}`}>
                <div className={`text-2xl font-bold ${scoreColor(m.value)}`}>
                  {m.value != null ? `${(m.value * 100).toFixed(0)}%` : "N/A"}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Results Table */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                {summary.total_evaluations} Evaluations
              </h3>
            </div>
            {results && results.items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Query</th>
                        <th className="px-6 py-3">Score</th>
                        <th className="px-6 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.items.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50"
                        >
                          <td className="px-6 py-3">{evalTypeBadge(r.eval_type)}</td>
                          <td className="max-w-md truncate px-6 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                            {r.query}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={scoreVariant(r.score)}>
                              {r.score != null ? `${(r.score * 100).toFixed(0)}%` : "N/A"}
                            </Badge>
                          </td>
                          <td className="px-6 py-3 text-xs text-zinc-400 dark:text-zinc-500">
                            {new Date(r.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={results.page}
                  totalPages={results.total_pages}
                  onPageChange={setPage}
                />
              </>
            ) : (
              <EmptyState
                icon={Activity}
                title="No evaluations yet"
                description='Click "Run Evaluation" to start evaluating your RAG pipeline'
              />
            )}
          </div>
        </>
      )}
      </div>{/* end scrollable */}
    </div>
  );
}
