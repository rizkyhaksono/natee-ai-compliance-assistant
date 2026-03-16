"use client";

import { useState, useEffect } from "react";
import { getEvaluationSummary, runEvaluation, EvaluationSummary } from "@/lib/api";
import { Activity, Play } from "lucide-react";

export default function EvaluationPage() {
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSummary = () => getEvaluationSummary().then(setSummary).catch(console.error);
  useEffect(() => { loadSummary(); }, []);

  const handleRunEval = async () => {
    setLoading(true);
    try { await runEvaluation(); await loadSummary(); }
    catch (err: any) { alert(`Error: ${err.message}`); }
    finally { setLoading(false); }
  };

  const scoreColor = (s: number | undefined | null) => {
    if (s == null) return "text-gray-400";
    if (s >= 0.8) return "text-green-600";
    if (s >= 0.6) return "text-amber-600";
    return "text-red-600";
  };

  const scoreBg = (s: number | undefined | null) => {
    if (s == null) return "bg-gray-50";
    if (s >= 0.8) return "bg-green-50 border-green-200";
    if (s >= 0.6) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Evaluation Dashboard</h2>
        <button onClick={handleRunEval} disabled={loading} className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          <Play className="w-4 h-4" />
          {loading ? "Running..." : "Run Evaluation"}
        </button>
      </div>
      {summary && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Retrieval Relevance", value: summary.avg_retrieval_relevance },
              { label: "Faithfulness", value: summary.avg_faithfulness },
              { label: "Groundedness", value: summary.avg_groundedness },
              { label: "Citation Correctness", value: summary.avg_citation_correctness },
            ].map((m) => (
              <div key={m.label} className={`rounded-lg border p-4 ${scoreBg(m.value)}`}>
                <div className={`text-2xl font-bold ${scoreColor(m.value)}`}>{m.value != null ? `${(m.value * 100).toFixed(0)}%` : "N/A"}</div>
                <div className="text-xs text-gray-500 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-3 border-b"><h3 className="font-medium">{summary.total_evaluations} Evaluations</h3></div>
            {summary.results.length > 0 ? (
              <table className="w-full">
                <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="px-6 py-3">Type</th><th className="px-6 py-3">Query</th><th className="px-6 py-3">Score</th><th className="px-6 py-3">Date</th></tr></thead>
                <tbody>
                  {summary.results.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-3"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{r.eval_type}</span></td>
                      <td className="px-6 py-3 text-sm text-gray-700 max-w-md truncate">{r.query}</td>
                      <td className={`px-6 py-3 text-sm font-medium ${scoreColor(r.score)}`}>{r.score != null ? `${(r.score * 100).toFixed(0)}%` : "N/A"}</td>
                      <td className="px-6 py-3 text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-gray-400"><Activity className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No evaluations yet. Click &quot;Run Evaluation&quot; to start.</p></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
