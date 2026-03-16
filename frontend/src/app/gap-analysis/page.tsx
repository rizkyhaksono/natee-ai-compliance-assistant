"use client";

import { useState, useEffect } from "react";
import { getDocuments, runGapAnalysis, Document, GapAnalysisResponse } from "@/lib/api";
import { GitCompareArrows, AlertTriangle, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

export default function GapAnalysisPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [regulationDocId, setRegulationDocId] = useState("");
  const [internalDocId, setInternalDocId] = useState("");
  const [judgmentMode, setJudgmentMode] = useState("moderate");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GapAnalysisResponse | null>(null);

  useEffect(() => {
    getDocuments().then((docs) => setDocuments(docs.filter((d) => d.status === "ready"))).catch(console.error);
  }, []);

  const handleAnalyze = async () => {
    if (!regulationDocId || !internalDocId) return;
    setLoading(true);
    try {
      const res = await runGapAnalysis(regulationDocId, internalDocId, judgmentMode);
      setResult(res);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
    compliant: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    partial: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
    non_compliant: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
    not_found: { icon: HelpCircle, color: "text-gray-500", bg: "bg-gray-50" },
  };

  const riskColors: Record<string, string> = {
    high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700",
    low: "bg-blue-100 text-blue-700", compliant: "bg-green-100 text-green-700",
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Gap Analysis</h2>
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Regulation Document</label>
            <select value={regulationDocId} onChange={(e) => setRegulationDocId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Select regulation...</option>
              {documents.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Internal Document</label>
            <select value={internalDocId} onChange={(e) => setInternalDocId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Select internal doc...</option>
              {documents.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Judgment Mode</label>
            <select value={judgmentMode} onChange={(e) => setJudgmentMode(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="lenient">Lenient</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleAnalyze} disabled={loading || !regulationDocId || !internalDocId} className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <GitCompareArrows className="w-4 h-4" />
              {loading ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
        </div>
      </div>
      {result && (
        <>
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4 text-center"><div className="text-2xl font-bold">{result.total_items}</div><div className="text-xs text-gray-500">Total Items</div></div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center"><div className="text-2xl font-bold text-green-600">{result.compliant_count}</div><div className="text-xs text-gray-500">Compliant</div></div>
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 text-center"><div className="text-2xl font-bold text-amber-600">{result.partial_count}</div><div className="text-xs text-gray-500">Partial</div></div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center"><div className="text-2xl font-bold text-red-600">{result.non_compliant_count}</div><div className="text-xs text-gray-500">Non-Compliant</div></div>
            <div className="bg-gray-50 rounded-lg border p-4 text-center"><div className="text-2xl font-bold text-gray-500">{result.not_found_count}</div><div className="text-xs text-gray-500">Not Found</div></div>
          </div>
          <div className="bg-white rounded-lg border p-4 mb-6">
            <span className={`text-xs px-2 py-1 rounded-full ${riskColors[result.overall_risk]}`}>Overall Risk: {result.overall_risk.toUpperCase()}</span>
            <p className="text-sm text-gray-700 mt-2">{result.summary}</p>
          </div>
          <div className="space-y-3">
            {result.gaps.map((gap, i) => {
              const config = statusConfig[gap.status] || statusConfig.not_found;
              const Icon = config.icon;
              return (
                <div key={i} className={`rounded-lg border p-4 ${config.bg}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{gap.regulation_clause}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${riskColors[gap.risk_level]}`}>{gap.risk_level}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{gap.gap_description}</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><span className="font-medium text-gray-500">Regulation:</span><p className="text-gray-600 mt-1">{gap.regulation_text}</p></div>
                        <div><span className="font-medium text-gray-500">Internal:</span><p className="text-gray-600 mt-1">{gap.internal_text || "Not found"}</p></div>
                      </div>
                      <div className="mt-2 text-xs"><span className="font-medium text-gray-500">Recommended Action:</span><p className="text-gray-700 mt-1">{gap.recommended_action}</p></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
