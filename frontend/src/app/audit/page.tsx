"use client";

import { useState, useEffect } from "react";
import { getAuditLogs, AuditLog } from "@/lib/api";
import { ScrollText, Star } from "lucide-react";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getAuditLogs(filter || undefined).then(setLogs).catch(console.error);
  }, [filter]);

  const actionColors: Record<string, string> = {
    qa_query: "bg-blue-100 text-blue-700",
    gap_analysis: "bg-purple-100 text-purple-700",
    checklist_generation: "bg-green-100 text-green-700",
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Audit Trail</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          <option value="">All actions</option>
          <option value="qa_query">Q&A Queries</option>
          <option value="gap_analysis">Gap Analysis</option>
          <option value="checklist_generation">Checklist Generation</option>
        </select>
      </div>
      {logs.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No audit logs yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {logs.map((log) => (
            <div key={log.id} className="px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${actionColors[log.action] || "bg-gray-100 text-gray-700"}`}>{log.action}</span>
                  {log.judgment_mode && <span className="text-xs text-gray-400">Mode: {log.judgment_mode}</span>}
                  {log.confidence_score != null && <span className="text-xs text-gray-400">Confidence: {(log.confidence_score * 100).toFixed(0)}%</span>}
                </div>
                <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              {log.query && <div className="mb-2"><span className="text-xs font-medium text-gray-500">Query:</span><p className="text-sm text-gray-700">{log.query}</p></div>}
              {log.response && <div className="mb-2"><span className="text-xs font-medium text-gray-500">Response:</span><p className="text-sm text-gray-600 line-clamp-3">{log.response}</p></div>}
              {log.guardrail_flags && log.guardrail_flags.length > 0 && (
                <div className="flex gap-1 mb-2">{log.guardrail_flags.map((flag, i) => (<span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">⚠️ {flag}</span>))}</div>
              )}
              {log.reviewer_score != null && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Star className="w-3 h-3 text-amber-500" />
                  Review Score: {log.reviewer_score}/5{log.reviewer_feedback && ` — "${log.reviewer_feedback}"`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
